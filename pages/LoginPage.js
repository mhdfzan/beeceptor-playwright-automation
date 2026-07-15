// @ts-check

/**
 * Page Object — Beeceptor Login.
 *
 * Beeceptor allows anonymous endpoint creation on the free tier, but
 * authenticated sessions get access to persisted endpoints & higher limits.
 * This POM only kicks in when credentials are supplied via env.
 */
class LoginPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.loginUrl = 'https://app.beeceptor.com/login';
  }

  async goto() {
    await this.page.goto(this.loginUrl, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Perform an email/password login.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    await this.goto();

    const emailInput = this.page
      .locator('input[type="email"], input[name="email"], #email')
      .first();
    const passwordInput = this.page
      .locator('input[type="password"], input[name="password"], #password')
      .first();
    const submitBtn = this.page.locator('button[type="submit"], input[type="submit"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitBtn.click();

    // Wait for redirect away from /login
    await this.page.waitForURL((url) => !url.href.includes('/login'), {
      timeout: 20_000,
    });
  }

  /**
   * Cheap check — are we already logged in?
   */
  async isLoggedIn() {
    try {
      const indicator = this.page.locator('text=/My Endpoints|Create Endpoint|Dashboard/i').first();
      return await indicator.isVisible({ timeout: 4_000 });
    } catch {
      return false;
    }
  }
}

module.exports = { LoginPage };
