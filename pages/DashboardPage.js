// @ts-check
const { config } = require('../utils/config');

/**
 * Page Object — Beeceptor Dashboard / Home.
 *
 * Handles endpoint creation from the homepage and navigation to the
 * per-endpoint console. Also supports the "reuse existing endpoint"
 * path (BEECEPTOR_ENDPOINT env var) to sidestep free-tier rate limits.
 */
class DashboardPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(config.urls.home, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Create a brand-new endpoint by typing a name and clicking the CTA.
   *
   * @param {string} endpointName
   * @returns {Promise<string>} trigger URL
   */
  async createEndpoint(endpointName) {
    await this.goto();
    await this.page.waitForLoadState('networkidle');

    const nameInput = this.page
      .locator('input[name="endpointName"], input[placeholder*="endpoint" i], input#endpointName')
      .first();
    await nameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await nameInput.fill(endpointName);

    const createBtn = this.page
      .locator('button:has-text("Create Endpoint"), button[type="submit"]')
      .first();
    await createBtn.click();

    // Beeceptor routes us to the endpoint console
    await this.page.waitForURL(/console\//, { timeout: 30_000 });
    return config.endpoint.triggerUrl(endpointName);
  }

  /**
   * Navigate directly to an endpoint's console (used when reusing).
   * @param {string} endpointName
   */
  async openConsole(endpointName) {
    await this.page.goto(config.urls.console(endpointName), {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create or reuse — the entry point every test should call.
   * @param {string} endpointName
   * @returns {Promise<string>} trigger URL
   */
  async createOrReuse(endpointName) {
    if (config.endpoint.reuseName) {
      await this.openConsole(endpointName);
      return config.endpoint.triggerUrl(endpointName);
    }
    return this.createEndpoint(endpointName);
  }
}

module.exports = { DashboardPage };
