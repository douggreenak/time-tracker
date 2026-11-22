import { defineConfig } from "@playwright/test";

// Uses the locally installed Google Chrome, so no browser download is needed.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // One shared in-memory database, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
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
    reuseExistingServer: false,
    // Throwaway in-memory database so tests never touch real data.
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "", ENABLE_DEMO_DATA: "true" },
    timeout: 120_000,
  },
});
