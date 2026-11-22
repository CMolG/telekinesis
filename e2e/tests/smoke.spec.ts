import { expect, test } from "@playwright/test";

// Validates the harness itself: the playground builds, `vite preview` boots
// as Playwright's webServer, and the page is reachable at baseURL. Later
// tasks add specs that exercise window.__telekinesis and real recordings.
test("playground responds and serves the app shell", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("Telekinesis · Playground");
});
