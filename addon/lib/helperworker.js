/** Adds a worker (viewerworker) to any pages on the pageshot domain

    Also handles requests from those pages, as piped through the worker

    This gives pageshot pages the ability to do things like copy to the
    clipboard.
    */

var self = require("sdk/self");
var simplePrefs = require('sdk/simple-prefs');
var { captureTab } = require("./screenshot");
var pageMod = require("sdk/page-mod");
var clipboard = require("sdk/clipboard");
var notifications = require("sdk/notifications");
var { XMLHttpRequest } = require("sdk/net/xhr");
const { watchFunction, watchWorker } = require("./errors");

var existing;

function resetPageMod(backend) {
  backend = backend || simplePrefs.prefs.backend;
  if (existing) {
    existing.destroy();
  }
  var include = backend.replace(/^https?:\/\//, "");
  include = include.replace(/\/.*/, "");
  include = include.replace(/:.*/, "");
  include = "*." + include;
  existing = pageMod.PageMod({
    include: include,
    contentScriptFile: [self.data.url("viewerworker.js")],
    onAttach: function (worker) {
      watchWorker(worker);
      worker.port.on("requestScreenshot", watchFunction(function (info) {
        captureTab(worker.tab, info).then(function (image) {
          worker.port.emit("screenshot", image, info);
        }, function (error) {
          console.error("Got error taking screenshot:", error);
        });
      }));
      worker.port.on("requestClipboard", watchFunction(function (info) {
        if (info.text) {
          clipboard.set(info.text, "text");
        }
        if (info.image) {
          clipboard.set(info.image, "html");
        }
        if (info.html) {
          clipboard.set(info.html, "html");
        }
        if (info.confirmationMessage) {
          notifications.notify({
            title: info.confirmationTitle,
            text: info.confirmationMessage,
            iconURL: backend + "/clipboard-8-xl.png"
          });
        }
      }));
      // Checks if a page has been modified by doing a conditional request
      // (doesn't work very well in practice, most sites don't return 304 on
      // content pages)
      worker.port.on("checkCaptured", watchFunction(function (pageInfo) {
        var captured = pageInfo.captured;
        var path = pageInfo.path;
        var url = pageInfo.url;
        var req = new XMLHttpRequest();
        // This scratch URL stuff is because the browser is fulfilling
        // requests with a 200 response even when it gets a 304
        // upstream, even though it is not supposed to do so when a
        // cache header is explicitly set.
        var scratchUrl = url;
        if (url.indexOf('?') == -1) {
          scratchUrl += '?';
        } else {
          scratchUrl += '&';
        }
        scratchUrl += '_cachebreak=' + Math.random();
        req.open("HEAD", scratchUrl);
        req.setRequestHeader("If-Modified-Since", (new Date(captured)).toUTCString());
        req.onload = function () {
          worker.port.emit("checkCapturedResult", {
            path: path,
            url: url,
            captured: captured,
            status: req.status
          });
        };
        req.send();
      }));
    }
  });
}

/** Used to track changes to to the backend pref */
exports.trackMods = function (backendOverride) {
  resetPageMod(backendOverride);
  simplePrefs.on("backend", function () {
    resetPageMod(simplePrefs.prefs.backend);
  });
};
