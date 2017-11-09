/* globals main, auth, catcher, deviceInfo, communication, log */

"use strict";

this.analytics = (function() {
  let exports = {};

  let telemetryPrefKnown = false;
  let telemetryPref;

  exports.sendEvent = function(action, label, options) {
    let eventCategory = "addon";
    if (!telemetryPrefKnown) {
      log.warn("sendEvent called before we were able to refresh");
      return Promise.resolve();
    }
    if (!telemetryPref) {
      log.info(`Cancelled sendEvent ${eventCategory}/${action}/${label || 'none'} ${JSON.stringify(options)}`);
      return Promise.resolve();
    }
    measureTiming(action, label);
    // Internal-only events are used for measuring time between events,
    // but aren't submitted to GA.
    if (action === 'internal') {
      return Promise.resolve();
    }
    if (typeof label == "object" && (!options)) {
      options = label;
      label = undefined;
    }
    options = options || {};
    let di = deviceInfo();
    return new Promise((resolve, reject) => {
      let url = main.getBackend() + "/event";
      let req = new XMLHttpRequest();
      req.open("POST", url);
      req.setRequestHeader("content-type", "application/json");
      req.onload = catcher.watchFunction(() => {
        if (req.status >= 300) {
          let exc = new Error("Bad response from POST /event");
          exc.status = req.status;
          exc.statusText = req.statusText;
          reject(exc);
        } else {
          resolve();
        }
      });
      options.applicationName = di.appName;
      options.applicationVersion = di.addonVersion;
      let abTests = auth.getAbTests();
      for (let [gaField, value] of Object.entries(abTests)) {
        options[gaField] = value;
      }
      log.info(`sendEvent ${eventCategory}/${action}/${label || 'none'} ${JSON.stringify(options)}`);
      req.send(JSON.stringify({
        deviceId: auth.getDeviceId(),
        event: eventCategory,
        action,
        label,
        options
      }));
    });
  };

  exports.refreshTelemetryPref = function() {
    return communication.sendToBootstrap("getTelemetryPref").then((result) => {
      telemetryPrefKnown = true;
      if (result === communication.NO_BOOTSTRAP) {
        telemetryPref = true;
      } else {
        telemetryPref = result;
      }
    }, (error) => {
      // If there's an error reading the pref, we should assume that we shouldn't send data
      telemetryPrefKnown = true;
      telemetryPref = false;
      throw error;
    });
  };

  exports.getTelemetryPrefSync = function() {
    catcher.watchPromise(exports.refreshTelemetryPref());
    return !!telemetryPref;
  };

  let timingData = {};

  // Configuration for filtering the sendEvent stream on start/end events.
  // When start or end events occur, the time is recorded.
  // When end events occur, the elapsed time is calculated and submitted
  // via `sendEvent`, where action = "perf-response-time", label = name of rule,
  // and cd1 value is the elapsed time in milliseconds.
  // If a cancel event happens between the start and end events, the start time
  // is deleted.
  let rules = [{
    name: 'page-action',
    start: { action: 'start-shot', label: 'toolbar-button' },
    end: { action: 'internal', label: 'unhide-preselection-frame' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'context-menu',
    start: { action: 'start-shot', label: 'context-menu' },
    end: { action: 'internal', label: 'unhide-preselection-frame' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'capture-full-page',
    start: { action: 'capture-full-page' },
    end: { action: 'internal', label: 'unhide-preview-frame' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'capture-visible',
    start: { action: 'capture-visible' },
    end: { action: 'internal', label: 'unhide-preview-frame' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'make-selection',
    start: { action: 'make-selection' },
    end: { action: 'internal', label: 'unhide-selection-frame' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'save-shot',
    start: { action: 'save-shot' },
    end: { action: 'internal', label: 'open-shot-tab' },
    cancel: [{ action: 'cancel-shot' }, { action: 'upload-failed' }]
  }, {
    name: 'save-visible',
    start: { action: 'save-visible' },
    end: { action: 'internal', label: 'open-shot-tab' },
    cancel: [{ action: 'cancel-shot' }, { action: 'upload-failed' }]
  }, {
    name: 'save-full-page',
    start: { action: 'save-full-page' },
    end: { action: 'internal', label: 'open-shot-tab' },
    cancel: [{ action: 'cancel-shot' }, { action: 'upload-failed' }]
  }, {
    name: 'save-full-page-truncated',
    start: { action: 'save-full-page-truncated' },
    end: { action: 'internal', label: 'open-shot-tab' },
    cancel: [{ action: 'cancel-shot' }, { action: 'upload-failed' }]
  }, {
    name: 'download-shot',
    start: { action: 'download-shot' },
    end: { action: 'internal', label: 'deactivate' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'download-full-page',
    start: { action: 'download-full-page' },
    end: { action: 'internal', label: 'deactivate' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'download-full-page-truncated',
    start: { action: 'download-full-page-truncated' },
    end: { action: 'internal', label: 'deactivate' },
    cancel: [{ action: 'cancel-shot' }]
  }, {
    name: 'download-visible',
    start: { action: 'download-visible' },
    end: { action: 'internal', label: 'deactivate' },
    cancel: [{ action: 'cancel-shot' }]
  }];

  // Match a filter (action and optional label) against an action and label.
  function match(filter, action, label) {
    return filter.label ?
      filter.action === action && filter.label === label :
      filter.action === action;
  }

  function anyMatches(filters, action, label) {
    let matched = false;
    filters.forEach(filter => {
      matched = matched || match(filter, action, label);
    });
    return matched;
  }

  function measureTiming(action, label) {
    rules.forEach(r => {
      if (anyMatches(r.cancel, action, label)) {
        delete timingData[r.name];
      } else if (match(r.start, action, label)) {
        timingData[r.name] = Date.now();
      } else if (timingData[r.name] && match(r.end, action, label)) {
        let endTime = Date.now();
        let elapsed = endTime - timingData[r.name];
        exports.sendEvent('perf-response-time', r.name, {cd1: elapsed});
        delete timingData[r.name];
      }
    });
  }

  return exports;
})();
