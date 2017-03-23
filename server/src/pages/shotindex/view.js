/* globals location, controller */
const sendEvent = require("../../browser-send-event.js");
const reactruntime = require("../../reactruntime");
const { Footer } = require("../../footer-view.js");
const React = require("react");
const ReactDOM = require("react-dom");

class Head extends React.Component {

  render() {
    return (
      <reactruntime.HeadTemplate {...this.props}>
        <script src={this.props.staticLink("/static/js/shotindex-bundle.js")} async></script>
        <link rel="stylesheet" href={this.props.staticLink("/static/css/shot-index.css")} />
      </reactruntime.HeadTemplate>
    );
  }

}


class Body extends React.Component {
  constructor(props) {
    super(props);
    this.state = {defaultSearch: props.defaultSearch};
  }

  render() {
    let children = [];
    for (let shot of this.props.shots) {
      children.push(this.renderShot(shot));
    }
    if (children.length === 0) {
      if (this.props.defaultSearch) {
        children.push(this.renderNoSearchResults());
      } else {
        children.push(this.renderNoShots());
      }
    }
    return (
      <reactruntime.BodyTemplate {...this.props}>
        <div className="column-space full-height default-color-scheme">
          <div id="shot-index-header" className="header">
            <h1><a href="/shots">My Shots</a></h1>
            <form onSubmit={ this.onSubmitForm.bind(this) }>
              <span className="search-label" />
              <input type="search" id="search" ref="search" maxLength="100" placeholder="search my shots" defaultValue={this.state.defaultSearch} onChange={this.onChangeSearch.bind(this)} />
              <button title="search"></button>
            </form>
          </div>
          <div id="shot-index" className="flex-1">
            <div className="responsive-wrapper row-wrap">
              {children}
            </div>
          </div>
          <Footer forUrl="shots" {...this.props} />
        </div>
      </reactruntime.BodyTemplate>
    );
  }

  renderNoShots() {
    return (
      <div className="large-icon-message-container" key="no-shots-found">
        <div className="large-icon logo-no-shots" />
        <div className="large-icon-message-string">Go forth and take shots!</div>
      </div>
    );
  }

  renderNoSearchResults() {
    return (
      <div className="large-icon-message-container" key="no-shots-found">
        <div className="large-icon logo-no-search-results" />
        <div className="large-icon-message-string">
          No shots matching "{this.props.defaultSearch}" found.
        </div>
      </div>
    );
  }

  renderShot(shot) {
    let imageUrl;
    let clip = shot.clipNames().length ? shot.getClip(shot.clipNames()[0]) : null;
    if (clip && clip.image && clip.image.url) {
      imageUrl = clip.image.url;
    } else if (shot.images.length) {
      imageUrl = shot.images[0].url;
    } else if (shot.fullScreenThumbnail) {
      imageUrl = shot.fullScreenThumbnail;
    } else {
      imageUrl = this.props.staticLinkWithHost("img/question-mark.svg");
    }
    let favicon = null;
    if (shot.favicon) {
      // We use background-image so if the image is broken it just doesn't show:
      favicon = <div style={{backgroundImage: `url("${shot.favicon}")`}} className="favicon" />;
    }

    return (
      <a href={shot.viewUrl}  className="shot" key={shot.id} onClick={this.onOpen.bind(this, shot.viewUrl)}>
        <div className="shot-image-container" style={{
          backgroundImage: `url(${imageUrl})`
        }}>
          <img className="shot-control" src={this.props.staticLink("/static/img/garbage-bin.svg")} onClick={this.onClickDelete.bind(this, shot)} />
        </div>
        <div className="title-container">
          <h4>{shot.title}</h4>
        </div>
        <div className="link-container">
          {favicon}
          <div className="shot-url">
            {shot.urlDisplay}
          </div>
        </div>
        <div className="inner-border"/>
      </a>
    );
  }

  onClickDelete(shot, event) {
    event.stopPropagation();
    event.preventDefault();
    sendEvent("start-delete", "my-shots", {useBeacon: true});
    if (window.confirm(`Delete ${shot.title}?`)) {
      sendEvent("delete", "my-shots-popup-confirm", {useBeacon: true});
      controller.deleteShot(shot);
    } else {
      sendEvent("cancel-delete", "my-shots-popup-confirm");
    }
    return false;
  }

  onOpen(url, event) {
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      // Don't override what might be an open-in-another-tab click
      sendEvent("goto-shot", "myshots-tile-new-tab", {useBeacon: true});
      return;
    }

    sendEvent("goto-shot", "myshots-tile", {useBeacon: true});
    location.href = url;
  }

  onSubmitForm(e) {
    e.preventDefault();
    let val = ReactDOM.findDOMNode(this.refs.search).value;
    if (val) {
      sendEvent("search", "submit");
    } else {
      sendEvent("clear-search", "submit");
    }
    controller.onChangeSearch(val);
  }

  onChangeSearch() {
    let val = ReactDOM.findDOMNode(this.refs.search).value;
    this.setState({defaultSearch: val});
    if (! val) {
      sendEvent("clear-search", "keyboard");
      controller.onChangeSearch(val);
      return;
    }
    if (this._keyupTimeout) {
      clearTimeout(this._keyupTimeout);
      this._keyupTimeout = undefined;
    }
    if (val.length > 3) {
      this._keyupTimeout = setTimeout(() => {
        sendEvent("search", "timed");
        controller.onChangeSearch(val);
      }, 1000);
    }
  }

  componentDidUpdate() {
    if ((this.props.defaultSearch || "") !== (this.state.defaultSearch || "")) {
      document.body.classList.add("search-results-loading");
    } else {
      document.body.classList.remove("search-results-loading");
    }
  }

}

exports.HeadFactory = React.createFactory(Head);
exports.BodyFactory = React.createFactory(Body);
