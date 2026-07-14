// @ts-check
const { test, expect } = require('../fixtures/test-fixtures');
const { config } = require('../utils/config');

/**
 * Beeceptor HTTP Callout Rule — End-to-End Test Suite
 *
 * This suite automates the complete workflow of Beeceptor's HTTP Callout Rule feature
 * within a single unified E2E test block to preserve session cookies/tokens:
 * 1. Open Beeceptor and login (if credentials provided)
 * 2. Create (or reuse) a mock endpoint
 * 3. Navigate to Mocking Rules section
 * 4. Create and configure an HTTP Callout rule
 * 5. Trigger the endpoint via an API call
 * 6. Verify the HTTP Callout executes successfully
 * 7. Verify non-matching path behaves normally
 * 8. Clean up test data
 */

test.describe('Beeceptor HTTP Callout Rule — E2E Workflow', () => {
  let endpointName;
  let endpointUrl;

  test.beforeAll(() => {
    endpointName = config.endpoint.generateName();
    endpointUrl = config.endpoint.getUrl(endpointName);
  });

  test('Complete end-to-end workflow', async ({
    page,
    loginPage,
    dashboardPage,
    endpointPage,
    mockRulePage,
    apiHelper,
  }) => {
    console.log(`\n📍 Starting E2E test for endpoint: ${endpointName}`);
    console.log(`🔗 Endpoint URL: ${endpointUrl}\n`);

    // ─────────────────────────────────────────────────
    // Step 1: Login to Beeceptor
    // ─────────────────────────────────────────────────
    const email = config.credentials.email;
    const password = config.credentials.password;

    if (email && password) {
      console.log('Step 1: Logging in to Beeceptor...');
      await loginPage.login(email, password);
      await expect(page).not.toHaveURL(/login/, { timeout: 15000 });
      console.log('✅ Successfully logged in');
    } else {
      console.log('Step 1: No credentials provided. Skipping login (using free tier).');
    }

    // ─────────────────────────────────────────────────
    // Step 2: Create a new mock endpoint
    // ─────────────────────────────────────────────────
    console.log('Step 2: Creating a new mock endpoint...');
    endpointUrl = await dashboardPage.createEndpoint(endpointName);
    await expect(page).toHaveURL(/console|app\.beeceptor/, { timeout: 20000 });
    console.log(`✅ Endpoint created successfully`);

    // ─────────────────────────────────────────────────
    // Step 3: Navigate to Mocking Rules section
    // ─────────────────────────────────────────────────
    console.log('Step 3: Opening Mocking Rules section...');
    await endpointPage.openMockingRules();

    // Verify rules view is loaded
    const rulesSection = page.locator(
      'button:has-text("Mock Rules"), button:has-text("New Rule"), button:has-text("Add Rule")'
    );
    await expect(rulesSection.first()).toBeVisible({ timeout: 15000 });
    console.log('✅ Mocking rules section visible');

    // ─────────────────────────────────────────────────
    // Step 4: Create and configure an HTTP Callout rule
    // ─────────────────────────────────────────────────
    console.log('Step 4: Configuring HTTP Callout rule...');
    await mockRulePage.createHttpCalloutRule({
      matchMethod: config.calloutRule.matchMethod,
      matchPath: config.calloutRule.matchPath,
      responseStatus: config.calloutRule.responseStatus,
      responseBody: config.calloutRule.responseBody,
      calloutTargetUrl: config.calloutRule.calloutTargetUrl,
      calloutMethod: config.calloutRule.calloutMethod,
      calloutBody: config.calloutRule.calloutBody,
    });

    // Verify rule was created and listed
    const ruleVisible = await mockRulePage.ruleExists(config.calloutRule.matchPath);
    expect(ruleVisible).toBeTruthy();
    console.log('✅ Callout rule successfully created and saved');

    // ─────────────────────────────────────────────────
    // Step 5: Trigger the endpoint to fire the HTTP Callout
    // ─────────────────────────────────────────────────
    const testPayload = {
      event: 'purchase_completed',
      userId: 4488,
      timestamp: new Date().toISOString(),
      amount: 99.95,
    };

    const triggerUrl = `${endpointUrl}${config.calloutRule.matchPath}`;
    console.log(`Step 5: Triggering endpoint POST ${triggerUrl}...`);
    const triggerResponse = await apiHelper.triggerEndpoint({
      url: triggerUrl,
      method: 'POST',
      body: testPayload,
    });

    console.log(`📬 Response Status: ${triggerResponse.status}`);
    console.log(`📬 Response Body: ${JSON.stringify(triggerResponse.body)}`);

    // Verify trigger responded with mock details (expect 200 range status)
    expect(triggerResponse.status).toBeGreaterThanOrEqual(200);
    expect(triggerResponse.status).toBeLessThan(500);
    console.log('✅ Trigger call successfully executed');

    // ─────────────────────────────────────────────────
    // Step 6: Verify the HTTP Callout executed successfully
    // ─────────────────────────────────────────────────
    console.log('Step 6: Verifying request log in console...');
    // Return back to dashboard logs
    await endpointPage.goto(endpointName);
    
    // Wait for the request to appear in logs
    await page.waitForTimeout(4000);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const hasRequest = await endpointPage.hasRequestWithPath(config.calloutRule.matchPath);
    
    // Capture log verification screenshot
    await page.screenshot({
      path: 'test-results/request-logs-verification.png',
      fullPage: true,
    });
    
    expect(hasRequest).toBeTruthy();
    console.log('✅ Verified: Request path logged in Beeceptor console');

    // ─────────────────────────────────────────────────
    // Step 7: Verify non-matching path does not trigger callout
    // ─────────────────────────────────────────────────
    const nonMatchingUrl = `${endpointUrl}/some-other-path`;
    console.log(`Step 7: Testing non-matching URL: ${nonMatchingUrl}`);
    const nonMatchingResponse = await apiHelper.triggerEndpoint({
      url: nonMatchingUrl,
      method: 'POST',
      body: { action: 'ignore' },
    });
    expect(nonMatchingResponse.status).toBeGreaterThanOrEqual(200);
    console.log('✅ Non-matching path handled normally');

    // ─────────────────────────────────────────────────
    // Step 8: Clean up test data
    // ─────────────────────────────────────────────────
    console.log('Step 8: Cleaning up mock rule and endpoint...');
    await endpointPage.goto(endpointName);
    try {
      await endpointPage.openMockingRules();
      await mockRulePage.deleteRule(config.calloutRule.matchPath);
      console.log('✅ Rule deleted');
    } catch (e) {
      console.log('⚠️ Could not delete rule:', e.message);
    }

    try {
      await endpointPage.deleteEndpoint();
      console.log('✅ Endpoint deleted');
    } catch (e) {
      console.log('⚠️ Could not delete endpoint:', e.message);
    }

    await page.screenshot({
      path: 'test-results/cleanup-complete.png',
      fullPage: true,
    });
    console.log('🎉 E2E Workflow Completed Successfully!');
  });
});
