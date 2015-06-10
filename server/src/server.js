const path = require('path');
const Cookies = require("cookies");
const helpers = require("./helpers");

const { Shot } = require("./servershot");
const { checkLogin, registerLogin } = require("./users");
const db = require("./db");
const dbschema = require("./dbschema");
const express = require("express");
const bodyParser = require('body-parser');
const morgan = require("morgan");
const linker = require("./linker");
const errors = require("./errors");
const config = require("./config").root();

dbschema.createTables();
dbschema.createKeygrip();

const app = express();

app.set('trust proxy', true);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json({limit: '100mb'}));

app.use("/static", express.static(path.join(__dirname, "static"), {
  index: false
}));

app.use(morgan("dev"));

app.use(function (req, res, next) {
  let cookies = new Cookies(req, res, dbschema.getKeygrip());
  req.userId = cookies.get("user", {signed: true});
  req.backend = req.protocol + "://" + req.headers.host;
  req.config = config;
  next();
});

app.use(function (req, res, next) {
  req.staticLink = linker.staticLink;
  req.staticLinkWithHost = linker.staticLinkWithHost.bind(null, req);
  next();
});

app.use(function (err, req, res, next) {
  console.error("Error:", err);
  console.error(err.stack);
  if (err.isAppError) {
    let { statusCode, headers, payload } = err.output;
    res.status(statusCode);
    res.header(headers);
    res.send(payload);
    return;
  }
  errorResponse(res, "General error:", err);
});

app.post("/api/register", function (req, res) {
  let vars = req.body;
  // FIXME: need to hash secret
  let canUpdate = vars.userId === req.userId;
  return registerLogin(vars.userId, {
    secret: vars.secret,
    nickname: vars.nickname || null,
    avatarurl: vars.avatarurl || null
  }, canUpdate).then(function (ok) {
    if (ok) {
      let cookies = new Cookies(req, res, dbschema.getKeygrip());
      cookies.set("user", vars.userId, {signed: true});
      simpleResponse(res, "Created", 200);
    } else {
      simpleResponse(res, "User exists", 401);
    }
  }).catch(function (err) {
    errorResponse(res, "Error registering:", err);
  });
});

app.post("/api/login", function (req, res) {
  let vars = req.body;
  checkLogin(vars.userId, vars.secret).then((ok) => {
    if (ok) {
      let cookies = new Cookies(req, res, dbschema.getKeygrip());
      cookies.set("user", vars.userId, {signed: true});
      simpleResponse(res, "User logged in", 200);
    } else {
      simpleResponse(res, "Invalid login", 401);
    }
  }).catch(function (err) {
    errorResponse(err, "Error in login:", err);
  });
});

app.get("/clip/:id/:domain/:clipId", function (req, res) {
  let shotId = req.params.id + "/" + req.params.domain;
  Shot.get(req.backend, shotId).then((shot) => {
    let clip = shot.getClip(req.params.clipId);
    if (! clip) {
      simpleResponse(res, "No such clip", 404);
      return;
    }
    let image = clip.imageBinary();
    res.set("Content-Type", image.contentType);
    res.send(image.data);
  }).catch((err) => {
    errorResponse(res, "Failed to get clip", err);
  });
});

app.put("/data/:id/:domain", function (req, res) {
  let bodyObj = req.body;
  if (typeof bodyObj != "object") {
    throw new Error("Got unexpected req.body type: " + typeof bodyObj);
  }
  let shotId = req.params.id + "/" + req.params.domain;

  if (! bodyObj.userId) {
    console.warn("No userId in request body", req.url);
    simpleResponse(res, "No userId in body", 400);
    return;
  }
  if (! req.userId) {
    console.warn("Attempted to PUT without logging in", req.url);
    simpleResponse(res, "Not logged in", 401);
    return;
  }
  if (req.userId != bodyObj.userId) {
    // FIXME: this doesn't make sense for comments or other stuff, see https://github.com/mozilla-services/pageshot/issues/245
    console.warn("Attempted to PUT a page with a different userId than the login userId");
    simpleResponse(res, "Cannot save a page on behalf of another user", 403);
    return;
  }
  let shot = new Shot(req.userId, req.backend, shotId, bodyObj);
  shot.insert().then((inserted) => {
    if (! inserted) {
      return shot.update();
    }
    return null;
  }).then(() => {
    simpleResponse(res, "Saved", 200);
  }).catch((err) => {
    errorResponse(res, "Error saving Object:", err);
  });
});

app.get("/data/:id/:domain", function (req, res) {
  let shotId = req.params.id + "/" + req.params.domain;
  Shot.getRawValue(shotId).then((data) => {
    if (! data) {
      simpleResponse(res, "No such shot", 404);
    } else {
      let value = data.value;
      if ('format' in req.query) {
        value = JSON.stringify(JSON.parse(value), null, '  ');
      }
      res.set("Content-Type", "application/json");
      res.send(value);
    }
  }).catch(function (err) {
    errorResponse(res, "Error serving data:", err);
  });
});

app.get("/content/:id/:domain", function (req, res) {
  let shotId = req.params.id + "/" + req.params.domain;
  Shot.get(req.backend, shotId).then((shot) => {
    if (! shot) {
      simpleResponse(res, "Not found", 404);
      return;
    }
    res.send(shot.staticHtml({
      addHead: `
      <base href="${shot.url}" target="_blank" />
      <script src="http:${req.staticLinkWithHost("js/content-helper.js")}"></script>
      <link rel="stylesheet" href="http:${req.staticLinkWithHost("css/content.css")}">
      `
    }));
  }).catch(function (e) {
    errorResponse(res, "Failed to load shot", e);
  });
});

app.get("/", function (req, res) {
  require("./views/main").render(req, res);
});

app.get("/:id/:domain", function (req, res) {
  let shotId = req.params.id + "/" + req.params.domain;
  Shot.get(req.backend, shotId).then((shot) => {
    if (! shot || shot.clipNames().length === 0) {
      simpleResponse(res, "Not found", 404);
      return;
    }
    req.shot = shot;
    return require("./views/frame").render(req, res);
  }).catch(function (err) {
    errorResponse(res, "Error rendering page:", err);
  });
});

const oAuthBaseURI = 'http://127.0.0.1:9010/v1',
  contentBaseURI = 'http://127.0.0.1:3030',
  profileBaseURI = 'http://127.0.0.1:1111/v1',
  oAuthClientId = 'ac7ee3c317531aab',
  oAuthClientSecret = 'eb7c92bd4616a7c1f86595492f360f55cc453974b062e71456d2d4b104f307f8';

// Get OAuth client params for the client-side authorization flow.
app.get('/api/fxa-oauth/params', function (req, res, next) {
  if (! req.userId) {
    next(errors.sessionRequired());
    return;
  }
  helpers.randomBytes(32).then(stateBytes => {
    let state = stateBytes.toString('hex');
    return setState(req.userId, state).then(inserted => {
      if (!inserted) {
        throw errors.dupeLogin();
      }
      return state;
    });
  }).then(state => {
    res.send({
      // FxA profile server URL.
      profile_uri: profileBaseURI,
      // FxA OAuth server URL.
      oauth_uri: oAuthBaseURI,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:fx:webchannel',
      client_id: oAuthClientId,
      // FxA content server URL.
      content_uri: contentBaseURI,
      state,
      scope: 'profile'
    });
  }).catch(next);
});

// Exchange an OAuth authorization code for an access token.
app.post('/api/fxa-oauth/token', function (req, res, next) {
  if (! req.userId) {
    next(errors.sessionRequired());
    return;
  }
  if (! req.body) {
    next(errors.paramsRequired());
    return;
  }
  let { code, state } = req.body;
  checkState(req.userId, state).then(isValid => {
    if (!isValid) {
      throw errors.invalidState();
    }
    let oAuthURI = `${oAuthBaseURI}/token`;
    return helpers.request('POST', oAuthURI, {
      payload: JSON.stringify({
        code,
        client_id: oAuthClientId,
        client_secret: oAuthClientSecret
      }),
      headers: {
        'content-type': 'application/json'
      },
      json: true
    }).then(([oAuthRes, body]) => {
      if (oAuthRes.statusCode < 200 || oAuthRes.statusCode > 299) {
        throw errors.badToken();
      }
      let { access_token: accessToken } = body;
      return getAccountId(accessToken).then(profile => {
        let { uid: accountId } = profile;
        return db.transaction(client => {
          return db.upsertWithClient(
            client,
            `INSERT INTO accounts (id, token) SELECT $1, $2`,
            `UPDATE accounts SET token = $2 WHERE id = $1`,
            [accountId, accessToken]
          ).then(() => {
            return db.queryWithClient(
              client,
              `UPDATE devices SET accountid = $2 WHERE id = $1`,
              [accountId, req.userId]
            );
          });
        }).then(() => {
          res.send({
            access_token: accessToken
          });
        });
      });
    });
  }).catch(next);
});

function setState(deviceId, state) {
  return db.insert(
    `INSERT INTO states (state, deviceid)
    VALUES ($1, $2)`,
    [state, deviceId]
  );
}

function checkState(deviceId, state) {
  return db.del(
    `DELETE FROM states WHERE state = $1 AND deviceid = $2`,
    [state, deviceId]
  ).then(rowCount => !! rowCount);
}

function getAccountId(accessToken) {
  let profileURI = `${profileBaseURI}/uid`;
  return helpers.request('GET', profileURI, {
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    json: true
  }).then(([res, body]) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    throw errors.badProfile();
  });
}

function simpleResponse(res, message, status) {
  status = status || 200;
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.status(status);
  res.send(message);
}

function errorResponse(res, message, err) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.status(500);
  if (err) {
    message += "\n" + err;
    if (err.stack) {
      message += "\n\n" + err.stack;
    }
  }
  res.send(message);
  console.error("Error: " + message, err+"", err);
}

linker.init().then(() => {
  app.listen(config.port);
  console.log(`server listening on http://localhost:${config.port}/`);
}).catch((err) => {
  console.error("Error getting revision:", err, err.stack);
});
