import { defineConfig, devices } from "@playwright/test";

/**
 * M0 accessibility baseline (audit only, no product changes).
 *
 * Runs against an ALREADY RUNNING production server; it does not start a webServer.
 *   DATABASE_URL=postgresql://hub:hub@localhost:55432/collab_hub APP_URL=http://localhost:3200 \
 *     RATE_LIMIT_MULTIPLIER=100 npx next start -p 3200
 *   npx playwright test -c docs/audit/a11y/playwright.a11y.config.ts
 *
 * Results (raw JSON, ARIA snapshots) land in docs/audit/a11y/results/.
 */
export const BASE_URL = process.env.A11Y_BASE_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: ".",
  testMatch: /a11y-.*\.(spec|setup)\.ts$/,
  outputDir: "./results/playwright-output",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    screenshot: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "setup", testMatch: /a11y-auth\.setup\.ts$/ },
    { name: "sweep", testMatch: /a11y-sweep\.spec\.ts$/, dependencies: ["setup"] },
    { name: "aria", testMatch: /a11y-aria\.spec\.ts$/, dependencies: ["setup"] },
    { name: "keyboard", testMatch: /a11y-keyboard\.spec\.ts$/, dependencies: ["setup", "sweep", "aria"] },
  ],
});
