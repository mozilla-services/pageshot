/* globals global, documentMetadata, util, uicontrol, ui, catcher */
/* globals buildSettings, domainFromUrl, randomString, shot, blobConverters */

"use strict";

this.shooter = (function() { // eslint-disable-line no-unused-vars
  const exports = {};
  const { AbstractShot } = shot;
  const isChrome = buildSettings.targetBrowser === "chrome";
  const RANDOM_STRING_LENGTH = 16;
  let backend;
  let shotObject;
  let supportsDrawWindow;
  const callBackground = global.callBackground;
  const clipboard = global.clipboard;

  function regexpEscape(str) {
    // http://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }

  function sanitizeError(data) {
    const href = new RegExp(regexpEscape(window.location.href), "g");
    const origin = new RegExp(`${regexpEscape(window.location.origin)}[^ \t\n\r",>]*`, "g");
    const json = JSON.stringify(data)
      .replace(href, "REDACTED_HREF")
      .replace(origin, "REDACTED_URL");
    const result = JSON.parse(json);
    return result;
  }

  catcher.registerHandler((errorObj) => {
    callBackground("reportError", sanitizeError(errorObj));
  });

  catcher.watchFunction(() => {
    const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    const ctx = canvas.getContext("2d");
    supportsDrawWindow = !!ctx.drawWindow;
  })();

  function captureToCanvas(selectedPos, captureType) {
    const height = selectedPos.bottom - selectedPos.top;
    const width = selectedPos.right - selectedPos.left;
    const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    const ctx = canvas.getContext("2d");
    let expand = window.devicePixelRatio !== 1;
    if (captureType === "fullPage" || captureType === "fullPageTruncated") {
      expand = false;
      canvas.width = width;
      canvas.height = height;
    } else {
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
    }
    if (expand) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    ui.iframe.hide();
    ctx.drawWindow(window, selectedPos.left, selectedPos.top, width, height, "#fff");
    return canvas;
  }

  const screenshotPage = exports.screenshotPage = function(selectedPos, captureType) {
    if (!supportsDrawWindow) {
      return null;
    }
    const canvas = captureToCanvas(selectedPos, captureType);
    const limit = buildSettings.pngToJpegCutoff;
    let dataUrl = canvas.toDataURL();
    if (limit && dataUrl.length > limit) {
      const jpegDataUrl = canvas.toDataURL("image/jpeg");
      if (jpegDataUrl.length < dataUrl.length) {
        // Only use the JPEG if it is actually smaller
        dataUrl = jpegDataUrl;
      }
    }
    return dataUrl;
  };

  function screenshotPageAsync(selectedPos, captureType) {
    if (!supportsDrawWindow) {
      return Promise.resolve(null);
    }
    const canvas = captureToCanvas(selectedPos, captureType);
    ui.iframe.showLoader();
    const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    return callBackground("canvasToDataURL", imageData);
  }

  async function screenshotInBackground(selectedPos) {
    ui.iframe.hide();
    await waitAnimationFrame();
    let result;
    try {
      result = await callBackground(
        "screenshotPage",
        // TODO: why isn't selectedPos.asJson defined here?
        selectedPos,
        {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth
        }
      );
    } finally {
      if (ui.iframe.element) {
        // It's possible the iframe has been torn down before this is called
        ui.iframe.unhide();
      }
    }
    return result;
  }

  function waitAnimationFrame() {
    return new Promise((resolve, reject) => {
      console.log("using timeout");
      window.requestAnimationFrame(resolve);
    });
  }

  let isSaving = null;

  exports.takeShot = function(captureType, selectedPos, url) {
    // isSaving indicates we're aleady in the middle of saving
    // we use a timeout so in the case of a failure the button will
    // still start working again
    if (Math.floor(selectedPos.left) === Math.floor(selectedPos.right) ||
        Math.floor(selectedPos.top) === Math.floor(selectedPos.bottom)) {
        const exc = new Error("Empty selection");
        exc.popupMessage = "EMPTY_SELECTION";
        exc.noReport = true;
        catcher.unhandled(exc);
        return;
    }
    let imageBlob;
    const uicontrol = global.uicontrol;
    let deactivateAfterFinish = true;
    if (isSaving) {
      return;
    }
    isSaving = setTimeout(() => {
      if (typeof ui !== "undefined") {
        // ui might disappear while the timer is running because the save succeeded
        ui.Box.clearSaveDisabled();
      }
      isSaving = null;
    }, 1000);
    selectedPos = selectedPos.asJson();
    let captureText = "";
    if (buildSettings.captureText) {
      captureText = util.captureEnclosedText(selectedPos);
    }
    // TODO: note, screenshotPage just bails if drawWindow isn't supported (i.e., bails if chrome)
    // should we just handle the chrome fallback there? instead of spreading it around each function?
    const dataUrl = url || screenshotPage(selectedPos, captureType);
    let prom = Promise.resolve(dataUrl);
    // TODO: is this really the right way to handle this case?
    // we are 1. going to background page to get shot
    // 2. serializing and sending shot back
    // 3. turning dataUrl into a blob
    // 4. sending to background again inside takeShot
    //
    // would it make more sense to just take and send the shot at once?
    if (!dataUrl) {
      prom = screenshotInBackground(selectedPos);
    }
    prom.then((dataUrl) => {
      let type = blobConverters.getTypeFromDataUrl(dataUrl);
      type = type ? type.split("/", 2)[1] : null;
      if (dataUrl) {
        imageBlob = buildSettings.uploadBinary ? blobConverters.dataUrlToBlob(dataUrl) : null;
        shotObject.delAllClips();
        shotObject.addClip({
          createdDate: Date.now(),
          image: {
            url: buildSettings.uploadBinary ? "" : dataUrl,
            type,
            captureType,
            text: captureText,
            location: selectedPos,
            dimensions: {
              x: selectedPos.right - selectedPos.left,
              y: selectedPos.bottom - selectedPos.top
            }
          }
        });
      }
      catcher.watchPromise(callBackground("takeShot", {
        captureType,
        captureText,
        scroll: {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth
        },
        selectedPos,
        shotId: shotObject.id,
        shot: shotObject.asJson(),
        imageBlob
      }).then((url) => {
        return clipboard.copy(url).then((copied) => {
          return callBackground("openShot", { url, copied });
        });
      }, (error) => {
        if ("popupMessage" in error && (error.popupMessage === "REQUEST_ERROR" || error.popupMessage === "CONNECTION_ERROR")) {
          // The error has been signaled to the user, but unlike other errors (or
          // success) we should not abort the selection
          deactivateAfterFinish = false;
          // We need to unhide the UI since screenshotPage() hides it.
          ui.iframe.unhide();
          return;
        }
        if (error.name !== "BackgroundError") {
          // BackgroundError errors are reported in the Background page
          throw error;
        }
      }).then(() => {
        if (deactivateAfterFinish) {
          uicontrol.deactivate();
        }
      }));
    });
  };

  exports.downloadShot = function(selectedPos, previewDataUrl, type) {
    const shotPromise = previewDataUrl ? Promise.resolve(previewDataUrl) : screenshotPageAsync(selectedPos, type);
    catcher.watchPromise(shotPromise.then(dataUrl => {
      let promise = Promise.resolve(dataUrl);
      if (!dataUrl) {
        promise = screenshotInBackground(selectedPos.asJson());
      }
      catcher.watchPromise(promise.then((dataUrl) => {
        let type = blobConverters.getTypeFromDataUrl(dataUrl);
        type = type ? type.split("/", 2)[1] : null;
        shotObject.delAllClips();
        shotObject.addClip({
          createdDate: Date.now(),
          image: {
            url: dataUrl,
            type,
            location: selectedPos
          }
        });
        ui.triggerDownload(dataUrl, shotObject.filename);
        uicontrol.deactivate();
      }));
    }))
  };

  let copyInProgress = null;
  exports.copyShot = function(selectedPos, previewDataUrl, type) {
    // This is pretty slow. We'll ignore additional user triggered copy events
    // while it is in progress.
    if (copyInProgress) {
      return;
    }
    // A max of five seconds in case some error occurs.
    copyInProgress = setTimeout(() => {
      copyInProgress = null;
    }, 5000);

    const unsetCopyInProgress = () => {
      if (copyInProgress) {
        clearTimeout(copyInProgress);
        copyInProgress = null;
      }
    }
    const shotPromise = previewDataUrl ? Promise.resolve(previewDataUrl) : screenshotPageAsync(selectedPos, type);
    catcher.watchPromise(shotPromise.then(dataUrl => {
      let promise = Promise.resolve(dataUrl);
      // dataUrl is falsy in chrome, where we fall back to `captureVisibleTab`,
      // available in the background page
      if (!dataUrl) {
        promise = screenshotInBackground(selectedPos.asJson());
      }
      promise.then((dataUrl) => {
        // in chrome, we just use clipboard.copy from here, then ask the
        // background page to notify the user, because chrome.clipboard isn't an API,
        // but document.execCommand("copy") is available in every context.
        //
        // in firefox, we pass the blob to the background page, ask it to do
        // the copying, as well as notify the user.
        if (isChrome) {
          return clipboard.copy(dataUrl).catch((err) => {
            throw new Error("Copying to clipboard failed: ", err);
          }).then((copied) => {
            return catcher.watchPromise(callBackground("copyShotToClipboardChrome"));
          });
        } else {
          const blob = blobConverters.dataUrlToBlob(dataUrl);
          catcher.watchPromise(callBackground("copyShotToClipboard", blob).then(() => {
            uicontrol.deactivate();
            unsetCopyInProgress();
          }, unsetCopyInProgress));
        }
      });
    }));
  };

  exports.sendEvent = function(...args) {
    const maybeOptions = args[args.length - 1];

    if (typeof maybeOptions === "object") {
      maybeOptions.incognito = browser.extension.inIncognitoContext;
    } else {
      args.push({incognito: browser.extension.inIncognitoContext});
    }

    callBackground("sendEvent", ...args);
  };

  catcher.watchFunction(() => {
    shotObject = new AbstractShot(
      backend,
      randomString(RANDOM_STRING_LENGTH) + "/" + domainFromUrl(location),
      {
        origin: shot.originFromUrl(location.href)
      }
    );
    shotObject.update(documentMetadata());
  })();

  return exports;
})();
null;
