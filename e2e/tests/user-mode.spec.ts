import { expect, test } from "@playwright/test";
import { neutralizeForcedDemoMode } from "../helpers";

// Protects the README's most-cited guarantee (README.md around lines 46-48):
// "Ship it and it compiles away to nothing for real users."
//
// That promise is about the LIBRARY as consumed by real apps. The playground
// deliberately forces demo mode on itself as a showcase
// (`setForcedDemoMode(true)` at module scope in playground/src/main.tsx), so
// this spec simulates a consuming app's end-user environment instead: the
// force flag is made inert and `navigator.webdriver` is spoofed to `false`
// (Playwright's default is `true`), which — with no `?demo` in the URL —
// leaves every one of `isDemoMode()`'s real detection conditions off.
test("real visitors get zero telekinesis footprint", async ({ page, context }) => {
  await neutralizeForcedDemoMode(context);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await page.goto("/");

  // Absence asserts need an anchor that proves the app actually booted —
  // otherwise a blank or crashed page would trivially satisfy them. Wait for
  // the React root to have rendered content before checking for telekinesis
  // artifacts.
  await page.waitForFunction(() => (document.getElementById("root")?.childElementCount ?? 0) > 0);

  expect(await page.evaluate(() => window.__telekinesis)).toBeUndefined();
  expect(await page.locator("[data-telekinesis-id]").count()).toBe(0);
  expect(await page.locator("#telekinesis-layer").count()).toBe(0);
});
