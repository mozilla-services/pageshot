/* jshint browser: true */
/* globals ga, Raven */

const React = require("react");
const { getGitRevision } = require("../linker");
const { ProfileButton } = require("./profile");
const { addReactScripts } = require("../reactutils");
const { gaActivation } = require("../ga-activation");

class ShareButtons extends React.Component {
  onClickShareButton(whichButton) {
    //console.log("onClickShareButton", whichButton);
    // FIXME implement analytics tracking here
  }

  onClickCopyButton(e) {
    let target = e.target;
    target.previousSibling.select();
    document.execCommand("copy");
    target.textContent = "Copied";
    setTimeout(function() {
      target.textContent = "Copy";
    }, 1000);
  }

  onClickInputField(e) {
    e.target.select();
  }

  onChange(e) {
    // Do nothing -- we simply need this event handler to placate React
  }

  render() {
    let size = this.props.large ? "32" : "16";
    return <div id="share-buttons-panel" className="share-row">
      <div>Share to email and social networks</div>
      <a onClick={ this.onClickShareButton.bind(this, "facebook") } target="_blank" href={ "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(this.props.shot.viewUrl) }>
        <img src={ this.props.staticLink(`img/facebook-${size}.png`) } />
      </a>
      <a onClick={ this.onClickShareButton.bind(this, "twitter") }target="_blank" href={"https://twitter.com/home?status=" + encodeURIComponent(this.props.shot.viewUrl) }>
        <img src={ this.props.staticLink(`img/twitter-${size}.png`) } />
      </a>
      <a onClick={ this.onClickShareButton.bind(this, "pinterest") }target="_blank" href={"https://pinterest.com/pin/create/button/?url=" + encodeURIComponent(this.props.shot.viewUrl) + "&media=" + encodeURIComponent(this.props.clipUrl) + "&description=" }>
        <img src={ this.props.staticLink(`img/pinterest-${size}.png`) } />
      </a>
      <a onClick={ this.onClickShareButton.bind(this, "email") }target="_blank" href={ `mailto:?subject=Fwd:%20${encodeURIComponent(this.props.shot.title)}&body=${encodeURIComponent(this.props.shot.title)}%0A%0A${encodeURIComponent(this.props.shot.viewUrl)}%0A%0ASource:%20${encodeURIComponent(this.props.shot.url)}%0A` }>
        <img src={ this.props.staticLink(`img/email-${size}.png`) } />
      </a>
      <hr />
      <div>Get a shareable link to your shot</div>
      <input className="copy-shot-link-input"
        value={ this.props.shot.viewUrl }
        onClick={ this.onClickInputField.bind(this) }
        onChange={ this.onChange.bind(this) } />
      <button
        className="copy-shot-link-button"
        onClick={ this.onClickCopyButton.bind(this) }>
        Copy
      </button>
    </div>;
  }
}

class Clip extends React.Component {

  onClickComment(e) {
    e.preventDefault();
    let node = React.findDOMNode(this.refs.commentHolder),
      img = React.findDOMNode(this.refs.commentBubble);

    if (node.style.display === "none") {
      node.style.display = "inline-block";
    } else {
      node.style.display = "none";
    }
    if (img.src.indexOf("/static/img/comment-bubble-open.png") !== -1) {
      img.src = "/static/img/comment-bubble.png";
    } else {
      img.src = "/static/img/comment-bubble-open.png";
    }
  }

  render() {
    let clip = this.props.clip,
      node = null,
      comments_nodes = [];

    if (clip.image === undefined) {
      node = <div className="text-clip" dangerouslySetInnerHTML={{__html: clip.text.html}} />;
    } else {
      if (this.props.previousClip === null) {
        node = <img data-step="2" data-intro="This is the clip. Taking multiple clips is easy. After you click the camera button, click 'Add Clip'." src={ clip.image.url } />;
      } else {
        node = <img src={ clip.image.url } />;
      }
    }

    let comments = clip.comments,
      closed = false;
    if (comments.length === 0) {
      comments = [{text: "No comments."}];
      closed = true;
    }

    for (let i = 0, l = comments.length; i < l; i++) {
      let c = comments[i];
      // FIXME add the username once implemented
      //           <span className="comment-user">{ c.user }</span>
      comments_nodes.push(
        <div
          key={ `comment.${i}` }
          className="comment">
          <span className="comment-text">{ c.text }</span>
        </div>
      );
    }
// <a href={`#clip=${encodeURIComponent(clip.id)}&source=clip-link`}>
    return <div ref="clipContainer" className="clip-container">
      <a href={ clip.image.url }>
        { node }
      </a>
    </div>;
  }
}

class TimeDiff extends React.Component {
  render() {
    if (this.props.simple) {
      return this.renderSimple();
    }
    let timeDiff;
    let seconds = (Date.now() - this.props.date) / 1000;
    if (seconds > 0) {
      if (seconds < 20) {
        timeDiff = "just now";
      } else if (seconds > 0 && seconds < 60) {
        timeDiff = "1 minute ago";
      } else if (seconds < 60*60) {
        timeDiff = `${Math.floor(seconds / 60)} minutes ago`;
      } else if (seconds < 60*60*24) {
        timeDiff = `${Math.floor(seconds / (60*60))} hours ago`;
      } else if (seconds < 60*60*48) {
        timeDiff = "yesterday";
      } else if (seconds > 0) {
        seconds += 60*60*2; // 2 hours fudge time
        timeDiff = `${Math.floor(seconds / (60*60*24))} days ago`;
      }
    } else {
      if (seconds > -20) {
        timeDiff = "very soon";
      } else if (seconds > -60) {
        timeDiff = "in 1 minute";
      } else if (seconds > -60*60) {
        timeDiff = `${Math.floor(seconds / -60)} minutes from now`;
      } else if (seconds > -60*60*24) {
        timeDiff = `${Math.floor(seconds / (-60*60))} hours from now`;
      } else if (seconds > -60*60*48) {
        timeDiff = "tomorrow";
      } else {
        seconds -= 60*60*2; // 2 hours fudge time
        timeDiff = `${Math.floor(seconds / (-60*60*24))} days from now`;
      }
    }
    return <span title={this.dateString(this.props.date)}>{timeDiff}</span>;
  }

  renderSimple() {
    return <span>{this.dateString(this.props.date)}</span>;
  }

  dateString(d) {
    if (! (d instanceof Date)) {
      d = new Date(d);
    }
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let month = months[d.getMonth() - 1];
    let hour = d.getHours();
    if (hour === 0) {
      hour = "12am";
    } else if (hour === 12) {
      hour = "12pm";
    } else if (hour > 12) {
      hour = (hour % 12) + "pm";
    } else {
      hour = hour + "am";
    }
    let year = 1900 + d.getYear();
    return `${month} ${d.getDay()} ${year}, ${hour}`;
  }
}

exports.TimeDiff = TimeDiff;

class Head extends React.Component {
  render() {
    let ogImage = [];
    if (this.props.shot) {
      for (let clipId in this.props.shot.clips) {
        let clip = this.props.shot.clips[clipId];
        if (clip.image) {
          let clipUrl = this.props.backend + "/clip/" + this.props.shot.id + "/" + clipId;
          ogImage.push(<meta key={ "ogimage" + this.props.shot.id } property="og:image" content={clipUrl} />);
          if (clip.image.dimensions) {
            ogImage.push(<meta key={ "ogimagewidth" + this.props.shot.id } property="og:image:width" content={clip.image.dimensions.x} />);
            ogImage.push(<meta key={ "ogimageheight" + this.props.shot.id } property="og:image:height" content={clip.image.dimensions.y} />);
          }
        }
      }
    }
    let ogTitle = null;
    if (this.props.shot && this.props.shot.ogTitle) {
      ogTitle = <meta propery="og:title" content={this.props.shot.ogTitle} />;
    }
    let oembed;
    if (! this.props.simple) {
      oembed = <link rel="alternate" type="application/json+oembed" href={this.props.shot.oembedUrl} title={`${this.props.shot.title} oEmbed`} />;
    }
    let postMessageOrigin = `${this.props.contentProtocol}://${this.props.contentOrigin}`;
    let js = [
      <link rel="stylesheet" href={ this.props.staticLink("vendor/introjs/introjs.css") } key="introjs-stylesheet" />,
      <script src={ this.props.staticLink("vendor/introjs/intro.js") } key="introjs-js" />,
      <script src={ this.props.staticLink("vendor/core.js") } key="core-js-js" />,
      <script src={ this.props.staticLink("js/server-bundle.js") } key="server-bundle-js" />,
    ];

    if (this.props.sentryPublicDSN) {
      js = js.concat([
        <script src={ this.props.staticLink("vendor/raven.js") } key="raven-js-js" />,
        <script dangerouslySetInnerHTML={{__html: `Raven.config("${this.props.sentryPublicDSN}").install(); window.Raven = Raven;`}}></script>,
      ]);
    }

    js = js.concat(gaActivation(this.props.gaId, this.props.deviceId, true));
    if (this.props.simple) {
      js = [];
    }
    return (
      <head>
        <meta charSet="UTF-8" />
        <title>{this.props.shot.title}</title>
        {js}
        <link rel="stylesheet" href={ this.props.staticLink("css/styles.css") } />
        <link rel="stylesheet" href={ this.props.staticLink("css/profile.css") } />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {oembed}
        {ogTitle}
        {ogImage}
        <script dangerouslySetInnerHTML={{__html: `var CONTENT_HOSTING_ORIGIN = "${postMessageOrigin}";`}}></script>
        <script src={ this.props.staticLink("js/parent-helper.js") } />
      </head>);
  }
}

class Frame extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  closeGetPageshotBanner() {
    let node = document.getElementById("use-pageshot-to-create");
    node.style.display = "none";
  }

  clickFullPageButton(e) {
    ga("send", "event", "website", "click-full-page-button", {page: location.toString()});
  }

  onChange(e) {
    let evt = new Event("hashchange");
    window.dispatchEvent(evt);
  }

  onClickUploadFullPage(e) {
    this.props.clientglue.requestSavedShot();
  }

  onClickShareButton(e) {
    let sharePanel = document.getElementById("share-buttons-panel");
    console.log("SHARE STYLE", sharePanel.style.display);
    if (sharePanel.style.display === "block") {
      sharePanel.style.display = "none";
    } else {
      sharePanel.style.display = "block";
    }
  }

  onClickDelete(e) {
    window.ga('send', 'event', 'website', 'click-delete-shot', {useBeacon: true});
    if (window.confirm("Are you sure you want to delete the shot permanently?")) {
      this.props.clientglue.deleteShot(this.props.shot);
    }
  }

  render() {
    let body;
    if (this.props.expireTime !== null && Date.now() > this.props.expireTime) {
      let expireTime = this.props.expireTime;
      if (typeof expireTime != "number") {
        expireTime = expireTime.getTime();
      }
      let deleteTime = new Date(expireTime + this.props.retentionTime);
      let restoreWidget;
      if (this.props.isOwner) {
        restoreWidget = (
          <p>
            Will be permanently deleted <TimeDiff date={deleteTime} />
            &#8195;<span className="link-button" onClick={this.onRestore.bind(this)}>restore for {intervalDescription(this.props.defaultExpiration)}</span>
          </p>
        );
      }
      // Note: any attributes used here need to be preserved
      // in the render() function
      body = <div id="container">
        <p>&nbsp;</p>
        <p>
          This shot has expired. You may visit the original page it was originally created from:
        </p>
        <h2><a href={this.props.shot.urlIfDeleted}>{this.props.shot.title}</a></h2>
        <p>
          <a href={this.props.shot.urlIfDeleted}>
            {this.props.shot.urlIfDeleted}
          </a>
        </p>
        { restoreWidget }
      </div>;
    } else {
      body = this.renderBody();
    }
    return body;
  }

  renderBody() {
    if (! this.props.shot) {
      return <body><div>Not Found</div></body>;
    }

    let shot = this.props.shot;
    let activeClipId = this.props.activeClipId;
    let shotId = this.props.shot.id;
    let shotDomain = this.props.shot.url; // FIXME: calculate

    let clips = [],
      clipNames = shot.clipNames(),
      previousClip = null,
      nextClip = null;

    for (let i=0; i < clipNames.length; i++) {
      let clipId = clipNames[i];
      let clip = shot.getClip(clipId);
      if (i + 1 < clipNames.length) {
        nextClip = shot.getClip(clipNames[i+1]);
      }
      if (i > 0) {
        previousClip = shot.getClip(clipNames[i-1]);
      }

      clips.push(<Clip staticLink={this.props.staticLink} key={ clipId } clip={ clip }  shotId={ shotId } shotDomain={ shotDomain } previousClip={ previousClip } nextClip={ nextClip } />);
    }

    let previousClipNode = null,
      nextClipNode = null,
      clipIndex = activeClipId ? clipNames.indexOf(activeClipId) : -1;

    let prevLink = null;
    if (clipIndex >= 1) {
      prevLink = `#clip=${encodeURIComponent(clipNames[clipIndex-1])}&source=clip-prev-link`;
    } else if (clipIndex === 0) {
      prevLink = "#";
    }

    if (prevLink) {
      previousClipNode = <a href={prevLink}>
        <img className="navigate-clips" src={ this.props.staticLink("img/up-arrow.png") } />
      </a>;
    } else {
      previousClipNode = <img className="navigate-clips disabled" src={ this.props.staticLink("img/up-arrow.png") } />;
    }

    if (clipIndex < clipNames.length - 1) {
      nextClipNode = <a href={`#clip=${encodeURIComponent(clipNames[clipIndex+1])}&source=clip-next-link`}>
        <img className="navigate-clips" src={ this.props.staticLink("img/down-arrow.png") } />
      </a>;
    } else {
      nextClipNode = <img className="navigate-clips disabled" src={ this.props.staticLink("img/down-arrow.png") } />;
    }

    let numberOfClips = clipNames.length;
    if (numberOfClips === 1) {
      numberOfClips = "1 clip";
    } else if (numberOfClips === 0) {
      numberOfClips = "No clips";
    } else {
      numberOfClips = numberOfClips + " clips";
    }
    if (clipIndex >= 0) {
      numberOfClips = (clipIndex + 1) + " of " + numberOfClips;
    }

    let linkTextShort = shot.urlDisplay;

    let timeDiff = <TimeDiff date={shot.createdDate} simple={this.props.simple} />;
    let expiresDiff = <span>
      <ExpireWidget
        expireTime={this.props.expireTime}
        onSaveExpire={this.onSaveExpire.bind(this)} />
    </span>;
    if (this.props.simple || ! this.props.isOwner) {
      expiresDiff = null;
    }

    let introJsStart = null;

    if (this.props.showIntro) {
        introJsStart = <script dangerouslySetInnerHTML={{__html: `
          window.introJSRunning = true;
          introJs()
          .setOption('showStepNumbers', false)
          .setOption('highlightClass', 'intro-js-highlight-overlay')
          .onchange(function (el) {
            if (el.getAttribute('data-step') === '4') {
              setTimeout(function () {
                introJs().exit();
                window.introJSRunning = false;
                clientglue.render();
              }, 1);
              document.dispatchEvent(new CustomEvent('content-tour-complete'))
            }
          })
          .onexit(function () {
            window.introJSRunning = false;
            clientglue.render();
          }).start();`}} />;
    }

    let frameHeight = 100;
    if (this.props.shot.documentSize) {
      frameHeight = this.props.shot.documentSize.height;
    }

    let shotRedirectUrl = `/redirect?to=${encodeURIComponent(shot.url)}`;

    /*
    <div id="full-screen-thumbnail">
      <img src={ this.props.shot.fullScreenThumbnail } onClick={ this.clickFullPageButton.bind(this) } />
    </div>
    */

    /*
    <div id="profile-widget">
      <ProfileButton
        staticLink={ this.props.staticLink }
        initialExpanded={ false }
        avatarurl={ this.props.avatarurl }
        nickname={ this.props.nickname }
        email={ this.props.email }
        deviceId={ this.props.deviceId }
        simple={ this.props.simple }
        allowExport={ this.props.allowExport }
      />
    </div>
    */

    return (
        <div id="container">
          { this.renderExtRequired() }
        <div id="toolbar" data-step="1" data-intro="This is the title of the page and a link to it's source.">
          <a href="/shots">
            <button className="my-shots-button">
              <img src={ this.props.staticLink("img/my-shots.png") } />
              <span>My Shots</span>
            </button>
          </a>
          <span className="shot-title"> { shot.title } </span>
          <span className="shot-subtitle">
            <span> – Saved from </span><a className="subheading-link" href={ shotRedirectUrl }>{ linkTextShort }</a>
          </span>
          <div className="shot-subtitle">
            <img height="16" width="16" style={{
              marginRight: "7px",
              position: "relative",
              top: "4px"}}
              src={ this.props.staticLink("img/clock.png") } />
            saved { timeDiff } – { expiresDiff }
          </div>
          <div className="more-shot-actions">
            {this.props.hasSavedShot ?
              <button id="upload-full-page" className="upload-full-page" onClick={ this.onClickUploadFullPage.bind(this) }>
                Upload full page
              </button>
              : null}
            <button className="share-button" onClick={ this.onClickShareButton.bind(this) }>
              Share
            </button>
            <button className="trash-button" onClick={ this.onClickDelete.bind(this) }>
              <img src={ this.props.staticLink("img/garbage-bin.png") } />
            </button>
          </div>
        </div>
        <ShareButtons
          large={ true }
          clipUrl={ shot.viewUrl }
          { ...this.props } />
        { clips }
        { this.props.shot.showPage ?
          <iframe width="100%" height={frameHeight} id="frame" src={ shot.contentUrl } style={ {backgroundColor: "#fff"} } /> : null }
        <div className="pageshot-footer">
          <a href="https://github.com/mozilla-services/pageshot">{this.props.productName}</a> — <a href={`https://github.com/mozilla-services/pageshot/commit/${getGitRevision()}`}>Updated {this.props.buildTime}</a>
        </div>
        <a className="feedback-footer" href={ "mailto:pageshot-feedback@mozilla.com?subject=Pageshot%20Feedback&body=" + shot.viewUrl }>Send Feedback</a>
        { introJsStart }
      </div>
    );

/*         <div id="navigate-toolbar" data-step="4" data-intro="The recall panel can be used to access your previously made shots.">
          <span className="clip-count">
            { numberOfClips }
          </span>
          { previousClipNode }
          { nextClipNode }
        </div>
*/

  }

  renderExtRequired() {
    if (this.props.isExtInstalled) {
      return null;
    }
    return <div id="use-pageshot-to-create">
      <a href={ this.props.backend } onClick={ this.clickedCreate.bind(this) }>To create your own shots, get the Firefox extension {this.props.productName}</a>.
      <a id="banner-close" onClick={ this.closeGetPageshotBanner }>&times;</a>
    </div>;
  }

  clickedCreate() {
    window.ga('send', 'event', 'website', 'click-install-banner', {useBeacon: true});
  }

  onSaveExpire(value) {
    this.props.clientglue.changeShotExpiration(this.props.shot, value);
  }

  onRestore() {
    this.props.clientglue.changeShotExpiration(this.props.shot, this.props.defaultExpiration);
  }

}

class ExpireWidget extends React.Component {

  constructor(props) {
    super(props);
    this.state = {isChangingExpire: false};
  }

  render() {
    if (this.state.isChangingExpire) {
      return this.renderChanging();
    } else if (this.props.expireTime === null) {
      return this.renderNoExpiration();
    } else {
      return this.renderNormal();
    }
  }

  renderChanging() {
    let minute = 60 * 1000;
    let hour = minute * 60;
    let day = hour * 24;
    return (
      <span>
        keep for <select ref="expireTime">
          <option value="cancel">Select time:</option>
          <option value="0">Indefinitely</option>
          <option value={ 10 * minute }>10 Minutes</option>
          <option value={ hour }>1 Hour</option>
          <option value={ day }>1 Day</option>
          <option value={ 7 * day }>1 Week</option>
          <option value={ 14 * day }>2 Weeks</option>
          <option value={ 31 * day }>1 Month</option>
        </select>
        &#8195;<span className="link-button" onClick={this.clickSaveExpire.bind(this)}>save</span>
        &#8195;<span className="link-button" onClick={this.clickCancelExpire.bind(this)}>cancel</span>
      </span>
    );
  }

  renderNoExpiration() {
    return (
      <span>
        does not expire
        &#8195;<span className="link-button" onClick={this.clickChangeExpire.bind(this)}>change</span>
      </span>
    );
  }

  renderNormal() {
    let desc = "expires";
    if (this.props.expireTime < Date.now()) {
      desc = "expired";
    }
    return (
      <span>
        {desc} <TimeDiff date={this.props.expireTime} simple={this.props.simple} />
        &#8195;<span className="link-button" onClick={this.clickChangeExpire.bind(this)}>change</span>
      </span>
    );
  }

  clickChangeExpire() {
    window.ga('send', 'event', 'website', 'click-change-expire', {useBeacon: true});
    this.setState({isChangingExpire: true});
  }

  clickCancelExpire() {
    window.ga('send', 'event', 'website', 'click-cancel-expire', {useBeacon: true});
    this.setState({isChangingExpire: false});
  }

  clickSaveExpire() {
    // FIXME: save the value that it was changed to?  Yes!  Not sure where to put it.
    let value = this.refs.expireTime.getDOMNode().value;
    if (value === "cancel") {
      this.clickCancelExpire();
      return;
    }
    value = parseInt(value, 10);
    window.ga('send', 'event', 'website', 'click-save-expire', {useBeacon: true, eventValue: value/60000});
    this.props.onSaveExpire(value);
    this.setState({isChangingExpire: false});
  }
}

function intervalDescription(ms) {
  let parts = [];
  let second = 1000;
  let minute = second*60;
  let hour = minute*60;
  let day = hour*24;
  if (ms > day) {
    let days = Math.floor(ms/day);
    if (days === 1) {
      parts.push("1 day");
    } else {
      parts.push(`${days} days`);
    }
    ms = ms % day;
  }
  if (ms > hour) {
    let hours = Math.floor(ms/hour);
    if (hours === 1) {
      parts.push("1 hour");
    } else {
      parts.push(`{$hours} hours`);
    }
    ms = ms % hour;
  }
  if (ms > minute) {
    let minutes = Math.floor(ms/minute);
    if (minutes === 1) {
      parts.push("1 minute");
    } else {
      parts.push(`${minutes} minutes`);
    }
    ms = ms % minute;
  }
  if (ms) {
    let seconds = Math.floor(ms/second);
    if (seconds === 1) {
      parts.push("1 second");
    } else {
      parts.push(`${seconds} seconds`);
    }
  }
  if (! parts.length) {
    parts.push("immediately");
  }
  return parts.join(" ");
}

let FrameFactory = React.createFactory(Frame);
let HeadFactory = React.createFactory(Head);

exports.FrameFactory = FrameFactory;

exports.render = function (req, res) {
  let showIntro = !!req.query.showIntro;
  let buildTime = require("../build-time").string;
  let serverPayload = {
    allowExport: req.config.allowExport,
    staticLink: req.staticLink,
    backend: req.backend,
    shot: req.shot,
    contentOrigin: req.config.contentOrigin,
    contentProtocol: req.protocol,
    id: req.shot.id,
    productName: req.config.productName,
    isExtInstalled: !!req.deviceId,
    isOwner: req.deviceId == req.shot.ownerId,
    gaId: req.config.gaId,
    deviceId: req.deviceId,
    buildTime: buildTime,
    showIntro: showIntro,
    simple: false,
    shotDomain: req.url, // FIXME: should be a property of the shot
    expireTime: req.shot.expireTime === null ? null: req.shot.expireTime.getTime(),
    retentionTime: req.config.expiredRetentionTime*1000,
    defaultExpiration: req.config.defaultExpiration*1000,
    sentryPublicDSN: req.config.sentryPublicDSN,
  };
  let headString = React.renderToStaticMarkup(HeadFactory(serverPayload));
  let frame = FrameFactory(serverPayload);
  let clientPayload = {
    allowExport: req.config.allowExport,
    gitRevision: getGitRevision(),
    backend: req.backend,
    shot: req.shot.asJson(),
    contentOrigin: req.config.contentOrigin,
    contentProtocol: req.protocol,
    id: req.shot.id,
    productName: req.config.productName,
    isExtInstalled: !!req.deviceId,
    isOwner: req.deviceId == req.shot.ownerId,
    gaId: req.config.gaId,
    deviceId: req.deviceId,
    shotDomain: req.url,
    urlIfDeleted: req.shot.urlIfDeleted,
    expireTime: req.shot.expireTime === null ? null : req.shot.expireTime.getTime(),
    deleted: req.shot.deleted,
    buildTime: buildTime,
    showIntro: showIntro,
    simple: false,
    retentionTime: req.config.expiredRetentionTime*1000,
    defaultExpiration: req.config.defaultExpiration*1000
  };
  if (serverPayload.expireTime !== null && Date.now() > serverPayload.expireTime) {
    serverPayload.shot = clientPayload.shot = {
      url: req.shot.url,
      docTitle: req.shot.title
    };
  }
  let body = React.renderToString(frame);
  let json = JSON.stringify(clientPayload);
  let result = addReactScripts(
`<html>
  ${headString}
  <body>
    <div id="react-body-container">${body}</div>
  </body></html>`, `
    var serverData = ${json};
    clientglue.setModel(serverData);
  `);
  res.send(result);
};

exports.renderSimple = function (req, res) {
  let buildTime = require("../build-time").string;
  let serverPayload = {
    allowExport: req.config.allowExport,
    staticLink: req.staticLink.simple,
    backend: req.backend,
    shot: req.shot,
    contentOrigin: req.config.contentOrigin,
    contentProtocol: req.protocol,
    id: req.shot.id,
    productName: req.config.productName,
    isExtInstalled: !!req.deviceId,
    gaId: null,
    deviceId: req.deviceId,
    buildTime: buildTime,
    showIntro: false,
    simple: true,
    shotDomain: req.url // FIXME: should be a property of the shot
  };
  let headString = React.renderToStaticMarkup(HeadFactory(serverPayload));
  let frame = FrameFactory(serverPayload);
  let body = React.renderToStaticMarkup(frame);
  body = `<!DOCTYPE HTML>
  ${headString}
  <body>${body}
  </body></html>`;
  res.send(body);
};
