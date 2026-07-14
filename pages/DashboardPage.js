// @ts-check
const { expect } = require('@playwright/test');

/**
 * Page Object for the Beeceptor Dashboard.
 * Handles endpoint creation and navigation.
 */
class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.homeUrl = 'https://beeceptor.com';
  }

  /** Navigate to the Beeceptor homepage */
  async goto() {
    await this.page.goto(this.homeUrl, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Create a new endpoint from the homepage.
   * @param {string} endpointName - The name for the new endpoint
   * @returns {Promise<string>} The full endpoint URL
   */
  async createEndpoint(endpointName) {
    await this.goto();
    await this.page.waitForLoadState('networkidle');

    // Find the endpoint name input on the homepage
    const endpointInput = this.page.locator(
      'input[name="endpointName"], input[placeholder*="endpoint" i], input[id*="endpoint" i], #endpoint-name, input.endpoint-input'
    );

    // If the main input isn't found, try a broader search
    if (await endpointInput.count() === 0) {
      // Look for input fields in the hero/create section
      const inputs = this.page.locator('input[type="text"]');
      await inputs.first().fill(endpointName);
    } else {
      await endpointInput.first().clear();
      await endpointInput.first().fill(endpointName);
    }

    // Click the create endpoint button
    const createButton = this.page.locator(
      'button:has-text("Create Endpoint"), button:has-text("Create"), input[type="submit"][value*="Create" i], button[type="submit"]'
    );
    await createButton.first().click();

    // Wait for navigation to the endpoint console
    await this.page.waitForURL(/app\.beeceptor\.com|console/, { timeout: 30000 });
    await this.page.waitForLoadState('networkidle');

    const endpointUrl = `https://${endpointName}.free.beeceptor.com`;
    return endpointUrl;
  }

  /**
   * Navigate to an existing endpoint's console.
   * @param {string} endpointName
   */
  async navigateToEndpoint(endpointName) {
    await this.page.goto(`https://app.beeceptor.com/console/${endpointName}`, {
      waitUntil: 'networkidle',
    });
  }

  /**
   * Check if an endpoint already exists by navigating to its console.
   * @param {string} endpointName
   * @returns {Promise<boolean>}
   */
  async endpointExists(endpointName) {
    try {
      await this.page.goto(`https://app.beeceptor.com/console/${endpointName}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      // Check if we're on the console page (not redirected to home)
      return this.page.url().includes('/console/');
    } catch {
      return false;
    }
  }

  /**
   * Create endpoint or reuse existing one.
   * @param {string} endpointName
   * @returns {Promise<string>} The endpoint URL
   */
  async createOrReuseEndpoint(endpointName) {
    const exists = await this.endpointExists(endpointName);
    if (exists) {
      console.log(`Reusing existing endpoint: ${endpointName}`);
      return `https://${endpointName}.free.beeceptor.com`;
    }
    console.log(`Creating new endpoint: ${endpointName}`);
    return await this.createEndpoint(endpointName);
  }
}

module.exports = { DashboardPage };
