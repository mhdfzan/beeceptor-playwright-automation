// @ts-check
const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

/**
 * Playwright Configuration for Beeceptor HTTP Callout Automation.
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // Test directory
  testDir: './tests',

  // Maximum time for the entire test run
  timeout: 120000,

  // Maximum time for each expect() assertion
  expect: {
    timeout: 15000,
  },

  // Run tests sequentially (Beeceptor UI state is shared)
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests once
  retries: process.env.CI ? 2 : 1,

  // Single worker to avoid Beeceptor session conflicts
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL
    baseURL: 'https://beeceptor.com',

    // Browser viewport
    viewport: { width: 1280, height: 720 },

    // Record video for every test (useful for demo)
    video: 'on',

    // Capture screenshot on failure
    screenshot: 'on',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Navigation timeout
    navigationTimeout: 30000,

    // Action timeout
    actionTimeout: 15000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
  },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Slow down actions for visual clarity during recording
        launchOptions: {
          slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
        },
      },
    },
  ],
});
