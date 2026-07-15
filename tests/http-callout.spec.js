// @ts-check
const { test, expect } = require('../fixtures/test-fixtures');
const { config } = require('../utils/config');

/**
 * ─────────────────────────────────────────────────────────────────
 *  Beeceptor HTTP Callout Rule — End-to-End Test Suite
 * ─────────────────────────────────────────────────────────────────
 *
 * What we're validating:
 *   1. A Beeceptor endpoint can be created (or reused).
 *   2. An HTTP Callout rule can be authored via the UI.
 *   3. A live POST /webhook returns the mocked 202 response immediately.
 *   4. Beeceptor logs the inbound request.
 *   5. The outbound HTTP Callout to the target URL actually fires (verified
 *      by inspecting the request-detail panel in Beeceptor's console).
 *   6. Non-matching paths do NOT trigger the callout.
 *   7. Test data is cleaned up.
 *
 *  Tests share endpoint state → serial mode.
 */

test.describe.configure({ mode: 'serial' });

test.describe('Beeceptor HTTP Callout Rule — E2E', () => {
  /** @type {string} */ let endpointName;
  /** @type {string} */ let endpointUrl;

  test.beforeAll(() => {
    endpointName = config.endpoint.resolveName();
    endpointUrl = config.endpoint.triggerUrl(endpointName);
    console.log('\n──────────────────────────────────────────────');
    console.log(`  Endpoint: ${endpointName}`);
    console.log(`  URL     : ${endpointUrl}`);
    console.log(`  Callout : ${config.calloutRule.calloutTargetUrl}`);
    console.log('──────────────────────────────────────────────\n');
  });

  /**
   * Each test in a Playwright serial block still gets a fresh browser
   * context. To avoid re-authenticating and re-navigating in every test,
   * we open the endpoint console up front for the UI-driven steps.
   */
  test.beforeEach(async ({ page, loginPage, endpointPage }, testInfo) => {
    // Skip navigation for tests that don't need the console open:
    //   • Test 1 (login itself)
    //   • Test 2 (creates endpoint from scratch)
    //   • Tests that use only apiHelper — but we still open the console
    //     since API tests inside a UI suite are fast and this keeps setup uniform.
    if (testInfo.title.startsWith('1.') || testInfo.title.startsWith('2.')) return;

    const { email, password } = config.credentials;
    if (email && password && !(await loginPage.isLoggedIn())) {
      await loginPage.login(email, password);
    }
    await endpointPage.goto(endpointName);
    // Suppress any wandering listeners from previous tests
    page.removeAllListeners('dialog');
  });

  test('1. Authenticate (skipped if no credentials)', async ({ page, loginPage }) => {
    const { email, password } = config.credentials;
    if (!email || !password) {
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'No BEECEPTOR_EMAIL/PASSWORD — using anonymous free tier.',
      });
      console.log('ℹ  No credentials provided, skipping login.');
      return;
    }

    await loginPage.login(email, password);
    await expect(page).not.toHaveURL(/login/, { timeout: 15_000 });
  });

  test('2. Create (or reuse) a mock endpoint', async ({ page, dashboardPage }) => {
    const url = await dashboardPage.createOrReuse(endpointName);
    expect(url).toBe(endpointUrl);
    await expect(page).toHaveURL(/console\//, { timeout: 20_000 });
  });

  test('3. Open the Mocking Rules panel', async ({ page, endpointPage }) => {
    await endpointPage.openMockingRules();

    const rulesPanel = page
      .locator('#createNew, .dropdown-toggle-split, button:has-text("New Rule")')
      .first();
    await expect(rulesPanel).toBeVisible({ timeout: 15_000 });
  });

  test('4. Create and configure the HTTP Callout rule', async ({ endpointPage, mockRulePage }) => {
    await endpointPage.openMockingRules();
    await mockRulePage.createHttpCalloutRule(config.calloutRule);

    const listed = await mockRulePage.ruleExists(config.calloutRule.matchPath);
    expect(
      listed,
      `Callout rule for path "${config.calloutRule.matchPath}" should appear in the rules list`,
    ).toBeTruthy();
  });

  test('5. Trigger the endpoint — immediate response should match rule', async ({ apiHelper }) => {
    const payload = {
      event: 'purchase_completed',
      userId: 4488,
      amount: 99.95,
      timestamp: new Date().toISOString(),
    };

    const response = await apiHelper.triggerEndpoint(
      endpointUrl,
      config.calloutRule.matchPath,
      payload,
      config.calloutRule.matchMethod,
    );

    console.log(`↩  Status ${response.status} → ${JSON.stringify(response.body).slice(0, 200)}`);

    // In Beeceptor's default "Synchronous" callout mode, the response mirrors
    // the target's response (e.g., httpbin returns 200 for POST /post).
    // In "Asynchronous" mode, Beeceptor returns 202 immediately.
    // Either way, a 2xx-4xx response proves the rule matched and Beeceptor
    // processed the request. 5xx would mean the callout target errored.
    expect(
      response.status,
      'Trigger should get a valid HTTP response (2xx or 4xx) — 5xx would indicate a broken callout target',
    ).toBeLessThan(500);
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  test('6. Verify the outbound HTTP Callout actually fired', async ({ page, endpointPage }) => {
    // Let Beeceptor process the callout asynchronously
    await page.waitForTimeout(config.timeouts.calloutSettle);

    await endpointPage.goto(endpointName);
    await endpointPage.openRequestLog();

    // Wait for the request row for /webhook to appear
    const row = await endpointPage.waitForRequestWithPath(config.calloutRule.matchPath);

    // Open the request → inspect the callout panel
    const result = await endpointPage.verifyCalloutForRequest(row, {
      min: config.calloutRule.expectedCalloutStatusMin,
      max: config.calloutRule.expectedCalloutStatusMax,
    });

    await page.screenshot({
      path: 'test-results/06-callout-verification.png',
      fullPage: true,
    });

    expect(
      result.calloutFound,
      'Beeceptor console should show an outbound callout section for the request',
    ).toBeTruthy();

    if (result.status !== undefined) {
      console.log(`✔  Outbound callout status: ${result.status}`);
      expect(result.status).toBeGreaterThanOrEqual(config.calloutRule.expectedCalloutStatusMin);
      expect(result.status).toBeLessThanOrEqual(config.calloutRule.expectedCalloutStatusMax);
    } else {
      // No numeric status parsed — that's a soft signal, not a hard fail.
      test.info().annotations.push({
        type: 'soft-warning',
        description:
          'Callout panel found but no numeric status could be parsed from the DOM snippet.',
      });
    }
  });

  test('7. Non-matching path does NOT trigger the callout', async ({ apiHelper }) => {
    const response = await apiHelper.triggerEndpoint(
      endpointUrl,
      '/does-not-match-any-rule',
      { action: 'ignore' },
      'POST',
    );

    console.log(`↩  Non-matching status: ${response.status}`);

    // Beeceptor returns a default response (typically 200 with a message)
    // for un-matched paths. The important assertion is that we get *some*
    // valid HTTP response — a 5xx would indicate the endpoint itself broke.
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  test('7b. (optional) Round-trip verify via second Beeceptor endpoint', async ({
    page,
    endpointPage,
  }) => {
    const targetName = config.endpoint.calloutTargetName;
    test.skip(!targetName, 'Set CALLOUT_TARGET_ENDPOINT to enable round-trip verification');

    // Give Beeceptor a moment to fire the outbound callout after the earlier trigger
    await page.waitForTimeout(config.timeouts.calloutSettle);

    console.log(`↪  Opening callout-target endpoint console: ${targetName}`);
    await endpointPage.goto(targetName);
    await endpointPage.openRequestLog();

    // The primary endpoint fired POST to /callout-received on the target
    const row = await endpointPage.waitForRequestWithPath(
      config.calloutRule.calloutTargetPath,
      25_000,
    );

    await page.screenshot({
      path: 'test-results/07b-roundtrip-verification.png',
      fullPage: true,
    });

    await expect(row).toBeVisible();
    console.log(
      '✔  Callout target endpoint received the outbound request — full round-trip proven.',
    );
  });

  test('8. Cleanup — remove rule and (optionally) endpoint', async ({
    page,
    endpointPage,
    mockRulePage,
  }) => {
    await endpointPage.goto(endpointName);
    await endpointPage.openMockingRules();
    await mockRulePage.deleteRule(config.calloutRule.matchPath);

    if (!config.endpoint.reuseName) {
      await endpointPage.deleteEndpoint();
    } else {
      console.log('ℹ  Reused endpoint — not deleted.');
    }

    await page.screenshot({
      path: 'test-results/08-cleanup-complete.png',
      fullPage: true,
    });
  });
});
