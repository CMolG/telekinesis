import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // records video and measures timing — concurrency would only add noise
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "pnpm --filter @telekinesis/playground preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
