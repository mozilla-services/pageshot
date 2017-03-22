/* globals AddonManager, Components, Services */

const OLD_ADDON_PREF_NAME = "extensions.jid1-NeEaf3sAHdKHPA@jetpack.deviceIdInfo";
const OLD_ADDON_ID = "jid1-NeEaf3sAHdKHPA@jetpack";
const ADDON_ID = "screenshots@mozilla.org";
const TELEMETRY_PREF = "toolkit.telemetry.enabled";
const PREF_BRANCH = "extensions.screenshots.";
const USER_DISABLE_PREF = "extensions.screenshots.disabled";
const SYSTEM_DISABLE_PREF = "extensions.screenshots.system-disabled";

const { interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/Services.jsm");
const { EmbeddedExtensionManager } = Cu.import("resource://gre/modules/LegacyExtensionsUtils.jsm");

const prefs = Services.prefs;
const prefObserver = {
  register: function() {
    prefs.addObserver(PREF_BRANCH, this, false);
  },

  unregister: function() {
    prefs.removeObserver(PREF_BRANCH, this);
  },

  observe: function(aSubject, aTopic, aData) {
    // aSubject is the nsIPrefBranch we're observing (after appropriate QI)
    // aData is the name of the pref that's been changed (relative to aSubject)
    if (aData == USER_DISABLE_PREF || aData == SYSTEM_DISABLE_PREF) {
      handleStartup();
    }
  }
};

function startup(data, reason) { // eslint-disable-line no-unused-vars
  prefObserver.register();
  handleStartup();
}

function shutdown(data, reason) { // eslint-disable-line no-unused-vars
  prefObserver.unregister();
}

function install(data, reason) {} // eslint-disable-line no-unused-vars

function uninstall(data, reason) {} // eslint-disable-line no-unused-vars

function getBoolPref(pref) {
  return prefs.getPrefType(pref) && prefs.getBoolPref(pref);
}

function shouldDisable() {
  return getBoolPref(USER_DISABLE_PREF) || getBoolPref(SYSTEM_DISABLE_PREF);
}

function handleStartup() {
  AddonManager.getAddonByID(ADDON_ID).then((addon) => {
    if (addon === null) {
      console.error("Unable to start WebExtension: wrapper addon not found");
      // TODO: Should we send this error to Sentry? #2420
      return;
    }

    const webExtension = EmbeddedExtensionManager.getEmbeddedExtensionFor({
      id: ADDON_ID,
      resourceURI: addon.getResourceURI().QueryInterface(Ci.nsIFileURL)
    });

    if (!shouldDisable() && !webExtension.started) {
      start(webExtension);
    } else if (shouldDisable()) {
      stop(webExtension);
    }
  });
}

function start(webExtension) {
  webExtension.startup().then((api) => {
    api.browser.runtime.onMessage.addListener(handleMessage);
  }).catch((err) => {
    // The startup() promise will be rejected if the webExtension was
    // already started (a harmless error), or if initializing the
    // WebExtension failed and threw (an important error).
    console.error(err);
    if (err.message !== "This embedded extension has already been started") {
      // TODO: Should we send these errors to Sentry? #2420
    }
  });
}

function stop(webExtension) {
  webExtension.shutdown().then(() => {
    EmbeddedExtensionManager.untrackEmbeddedExtension(webExtension);
  });
}

function handleMessage(msg, sender, sendReply) {
  if (!msg) {
    return;
  }

  if (msg.funcName === "getTelemetryPref") {
    let enableTelemetry = getBoolPref(TELEMETRY_PREF);
    sendReply({type: "success", value: enableTelemetry});
  } else if (msg.funcName === "getOldDeviceInfo") {
    let oldDeviceInfo = prefs.prefHasUserValue(OLD_ADDON_PREF_NAME) && prefs.getCharPref(OLD_ADDON_PREF_NAME);
    sendReply({type: "success", value: oldDeviceInfo || null});
  } else if (msg.funcName === "removeOldAddon") {
    AddonManager.getAddonByID(OLD_ADDON_ID, (addon) => {
      prefs.clearUserPref(OLD_ADDON_PREF_NAME);
      if (addon) {
        addon.uninstall();
      }
      sendReply({type: "success", value: !!addon});
    });
  }
}
