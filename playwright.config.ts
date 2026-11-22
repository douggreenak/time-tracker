import { defineConfig } from "@playwright/test";

// Uses the locally installed Google Chrome, so no browser download is needed.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    channel: "chrome",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100/engineer",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
