// @ts-check
const base = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { DashboardPage } = require('../pages/DashboardPage');
const { EndpointPage } = require('../pages/EndpointPage');
const { MockRulePage } = require('../pages/MockRulePage');
const { ApiHelper } = require('../utils/api-helper');
const { config } = require('../utils/config');

/**
 * Custom Playwright test fixtures that inject page objects
 * and shared utilities into each test.
 */
const test = base.test.extend({
  /** Login page object */
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  /** Dashboard page object */
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  /** Endpoint console page object */
  endpointPage: async ({ page }, use) => {
    await use(new EndpointPage(page));
  },

  /** Mock rule page object */
  mockRulePage: async ({ page }, use) => {
    await use(new MockRulePage(page));
  },

  /** API helper for triggering endpoints */
  apiHelper: async ({ request }, use) => {
    await use(new ApiHelper(request));
  },

  /** Test configuration */
  testConfig: async ({}, use) => {
    await use(config);
  },
});

module.exports = { test, expect: base.expect };
