import { defineConfig } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
// Software WebGL: headless Chromium has no GPU. The legacy `--use-gl=swiftshader`
// only works on the older pinned CI chromium; local managed Chrome needs the
// ANGLE form. See Global Constraints.
const glArgs = executablePath
  ? ["--no-sandbox", "--use-gl=swiftshader"]
  : ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"];

export default defineConfig({
  testDir: "./tools/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // A full act playthrough runs minutes (Act 1 fresh ~2.3m); seeded acts are
  // shorter but still multi-minute. Set here so specs don't each repeat it.
  timeout: 600_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    launchOptions: { ...(executablePath ? { executablePath } : {}), args: glArgs },
  },
  projects: [
    // The spine plays the whole game (all 7 acts) in one test — needs far
    // more than a single act's budget.
    { name: "spine",   testMatch: /spine\.spec\.ts$/, timeout: 1_800_000 },
    { name: "acts",    testMatch: /acts[\\/].*\.spec\.ts$/ },
    { name: "touch",   testMatch: /touch[\\/]touch\.spec\.ts$/ },
    { name: "walkout", testMatch: /walkout\.spec\.ts$/ },
    { name: "shots",   testMatch: /shots[\\/].*\.spec\.ts$/ },
  ],
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
