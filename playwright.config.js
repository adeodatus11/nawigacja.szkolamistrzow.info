import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 20_000,
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:8791",
    channel: process.env.PLAYWRIGHT_BROWSER === "chromium" ? undefined : "chrome",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8791",
    url: "http://127.0.0.1:8791",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
