// @ts-check
const base = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { DashboardPage } = require('../pages/DashboardPage');
const { EndpointPage } = require('../pages/EndpointPage');
const { MockRulePage } = require('../pages/MockRulePage');
const { ApiHelper } = require('../utils/api-helper');
const { config } = require('../utils/config');

/**
 * Custom Playwright fixtures — inject page objects and shared utilities
 * into each test, and pre-accept Beeceptor's GDPR cookie so the consent
 * banner never intercepts pointer events during a run.
 */
const test = base.test.extend({
  /**
   * Override the default `page` fixture to seed the `gdprConsent` cookie
   * on beeceptor.com before any navigation. Mirrors the exact cookie that
   * Beeceptor's "Accept" button sets on click.
   */
  page: async ({ page }, use) => {
    // 2030-06-14 → matches Beeceptor's own expiry
    const expiresAt = Math.floor(new Date('2030-06-14T07:00:00Z').getTime() / 1000);
    await page.context().addCookies([
      {
        name: 'gdprConsent',
        value: 'accepted',
        domain: '.beeceptor.com',
        path: '/',
        expires: expiresAt,
        sameSite: 'None',
        secure: true,
        httpOnly: false,
      },
    ]);
    await use(page);
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  endpointPage: async ({ page }, use) => {
    await use(new EndpointPage(page));
  },

  mockRulePage: async ({ page }, use) => {
    await use(new MockRulePage(page));
  },

  apiHelper: async ({ request }, use) => {
    await use(new ApiHelper(request));
  },

  testConfig: async ({}, use) => {
    await use(config);
  },
});

module.exports = { test, expect: base.expect };
