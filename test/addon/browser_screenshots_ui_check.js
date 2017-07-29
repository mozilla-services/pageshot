"use strict";

function checkElements(expectPresent, l) {
  for (let id of l) {
    is(!!document.getElementById(id), expectPresent, "element " + id + (expectPresent ? " is" : " is not") + " present");
  }
}

add_task(async function() {
  await promiseScreenshotsEnabled();

  registerCleanupFunction(async function() {
    await promiseScreenshotsReset();
  });

  await BrowserTestUtils.waitForCondition(
    () => document.getElementById("pageAction-panel-screenshots"),
    "Screenshots button should be present", 100, 100);

  checkElements(true, ["pageAction-panel-screenshots"]);
});
