import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`npm run build` first) served on
 * port 3100 with its own database, so they never touch development data.
 */
const PORT = 3100;
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://hub:hub@localhost:5432/collab_hub_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      RATE_LIMIT_MULTIPLIER: "100",
      UPLOAD_DIR: "./storage/e2e-uploads",
      LOG_LEVEL: "warn",
    },
  },
});
