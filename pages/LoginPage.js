// @ts-check
const { expect } = require('@playwright/test');

/**
 * Page Object for the Beeceptor Login Page.
 * Handles user authentication via email/password.
 */
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.loginUrl = 'https://app.beeceptor.com/login';
  }

  /** Navigate to the login page */
  async goto() {
    await this.page.goto(this.loginUrl, { waitUntil: 'networkidle' });
  }

  /**
   * Login with email and password.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    await this.goto();

    // Wait for the login form to be visible
    await this.page.waitForLoadState('networkidle');

    // Fill email field - try multiple selector strategies
    const emailInput = this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], #email');
    if (await emailInput.count() > 0) {
      await emailInput.first().fill(email);
    } else {
      // Fallback: look for any text input that might be for email
      const inputs = this.page.locator('input[type="text"]');
      await inputs.first().fill(email);
    }

    // Fill password field
    const passwordInput = this.page.locator('input[type="password"], input[name="password"], #password');
    await passwordInput.first().fill(password);

    // Click login/submit button
    const loginButton = this.page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")');
    await loginButton.first().click();

    // Wait for navigation after login
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if the user is already logged in by looking for dashboard indicators.
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    try {
      // Check for typical logged-in indicators
      const loggedInIndicator = this.page.locator('text=My Endpoints, text=Dashboard, text=My Account, .user-info-container, text=Create Endpoint').first();
      return await loggedInIndicator.isVisible({ timeout: 5000 });
    } catch {
      return false;
    }
  }

  /**
   * Ensure we are logged in. If not, perform login.
   * @param {string} email
   * @param {string} password
   */
  async ensureLoggedIn(email, password) {
    const loggedIn = await this.isLoggedIn();
    if (!loggedIn) {
      await this.login(email, password);
    }
  }
}

module.exports = { LoginPage };
