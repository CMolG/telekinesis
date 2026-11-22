import { expect, test } from "@playwright/test";
import { neutralizeForcedDemoMode, waitForRuntime } from "../helpers";

test("the runtime installs and exposes the playground's frames", async ({ page }) => {
  await page.goto("/?demo");
  await waitForRuntime(page);

  // "welcome" is gated behind the playground's `loggedIn` state (see
  // playground/src/App.tsx) and only mounts once the login button is clicked,
  // so drive that interaction and poll the registry — the same signal the
  // assertions below read — until the frame lands.
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.waitForFunction(() =>
    window.__telekinesis.listFrames().some((f: { id: string }) => f.id === "welcome"),
  );

  const frames = await page.evaluate(() => window.__telekinesis.listFrames());
  const ids = frames.map((f: { id: string }) => f.id);
  for (const expected of [
    "pricing",
    "tier-pro",
    "tier-pro-cta",
    "email",
    "password",
    "login",
    "welcome",
  ]) {
    expect(ids).toContain(expected);
  }

  const rect = await page.evaluate(() => window.__telekinesis.getRect("pricing"));
  expect(rect!.width).toBeGreaterThan(100);
});

test("navigator.webdriver activates demo mode without ?demo", async ({ page, context }) => {
  // The playground force-enables demo mode for every visitor, which would
  // install the runtime even if webdriver detection were broken — neutralize
  // the force flag so `waitForRuntime` resolving genuinely proves the
  // `navigator.webdriver === true` condition (Playwright's default) fired.
  await neutralizeForcedDemoMode(context);
  await page.goto("/"); // no ?demo — Playwright ⇒ navigator.webdriver === true
  await waitForRuntime(page); // if this resolves, webdriver detection worked
  expect(await page.locator("[data-telekinesis-id]").count()).toBeGreaterThan(0);
});
