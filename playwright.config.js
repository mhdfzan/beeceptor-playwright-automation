// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * Playwright configuration for the Beeceptor HTTP Callout E2E suite.
 *
 * Design decisions:
 *   • Sequential tests (workers: 1) — Beeceptor UI state is per-account.
 *   • Video always on — makes the assignment demo trivial to record.
 *   • Trace on first retry — cheap CI debugging without ballooning artifacts.
 *   • Chromium is the default project; Firefox/WebKit are opt-in via
 *     `PW_ALL_BROWSERS=1` for cross-browser sanity checks.
 */

const includeAllBrowsers = process.env.PW_ALL_BROWSERS === '1';

const projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : 0,
      },
    },
  },
];

if (includeAllBrowsers) {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  );
}

module.exports = defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 15_000 },

  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: 'https://beeceptor.com',
    viewport: { width: 1440, height: 800 },
    video: 'on',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
  },

  projects,
});
