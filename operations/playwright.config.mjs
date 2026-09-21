import { defineConfig, devices } from "@playwright/test";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1") {
  throw new Error("Run this browser suite through npm run test:operations.");
}
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.OPERATIONS_TEST_URL,
    ignoreHTTPSErrors: true,
    trace: "off",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 375, height: 812 }
      }
    }
  ]
});
