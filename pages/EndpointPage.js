// @ts-check
const { expect } = require('@playwright/test');

/**
 * Page Object for the Beeceptor Endpoint Console.
 * Handles navigation within the endpoint, viewing request logs, and cleanup.
 */
class EndpointPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a specific endpoint's console.
   * @param {string} endpointName
   */
  async goto(endpointName) {
    await this.page.goto(`https://app.beeceptor.com/console/${endpointName}`, {
      waitUntil: 'networkidle',
    });
  }

  /** Click on the Mocking Rules tab */
  async openMockingRules() {
    // Try multiple strategies to find the Mocking Rules tab/link
    const mockRulesTab = this.page.locator([
      'text=Mocking Rules',
      'a:has-text("Mocking Rules")',
      'button:has-text("Mocking Rules")',
      '[data-tab="rules"]',
      'text=Mock Rules',
    ].join(', '));

    await mockRulesTab.first().click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get the list of requests from the request history/logs.
   * @returns {Promise<number>} Number of logged requests
   */
  async getRequestCount() {
    // Wait a moment for requests to appear
    await this.page.waitForTimeout(2000);

    const requests = this.page.locator(
      '.request-item, .request-row, tr.request, [class*="request"], .history-item'
    );
    return await requests.count();
  }

  /**
   * Wait for a new request to appear in the logs.
   * @param {number} initialCount - The request count before triggering
   * @param {number} timeout - Max wait time in ms
   * @returns {Promise<boolean>} Whether a new request appeared
   */
  async waitForNewRequest(initialCount = 0, timeout = 15000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const currentCount = await this.getRequestCount();
      if (currentCount > initialCount) {
        return true;
      }
      await this.page.waitForTimeout(1000);
    }
    return false;
  }

  /**
   * Check if a specific request path appears in the logs.
   * @param {string} path - The request path to look for
   * @returns {Promise<boolean>}
   */
  async hasRequestWithPath(path) {
    await this.page.waitForTimeout(3000);
    // Reload to refresh request logs
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000);

    const requestWithPath = this.page.locator(`text=${path}`);
    return await requestWithPath.isVisible({ timeout: 10000 }).catch(() => false);
  }

  /**
   * Click on a request in the log to view its details.
   * @param {number} index - Zero-based index of the request (0 = most recent)
   */
  async viewRequestDetails(index = 0) {
    const requests = this.page.locator(
      '.request-item, .request-row, tr.request, [class*="request-entry"], .history-item'
    );
    const request = requests.nth(index);
    await request.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get the response status shown in request details.
   * @returns {Promise<string>}
   */
  async getResponseStatus() {
    const statusElement = this.page.locator(
      '.response-status, [class*="status"], .status-code'
    );
    return await statusElement.first().textContent() || '';
  }

  /**
   * Delete the endpoint (cleanup).
   * Navigates to settings and deletes the endpoint.
   */
  async deleteEndpoint() {
    try {
      // Look for delete/settings option
      const settingsButton = this.page.locator(
        'text=Settings, text=Delete, button:has-text("Delete"), a:has-text("Settings")'
      );
      if (await settingsButton.isVisible({ timeout: 5000 })) {
        await settingsButton.first().click();
        await this.page.waitForTimeout(1000);

        // Confirm deletion if there's a confirmation dialog
        const confirmDelete = this.page.locator(
          'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
        );
        if (await confirmDelete.isVisible({ timeout: 3000 })) {
          await confirmDelete.first().click();
        }
      }
    } catch (error) {
      console.log('Endpoint cleanup - could not delete endpoint:', error.message);
    }
  }
}

module.exports = { EndpointPage };
