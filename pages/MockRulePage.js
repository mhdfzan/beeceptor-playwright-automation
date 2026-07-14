// @ts-check
const { expect } = require('@playwright/test');

/**
 * Page Object for Beeceptor Mock Rule Creation and Configuration.
 * Handles creating, configuring, and managing HTTP Callout rules.
 */
class MockRulePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Click the "Create New Rule" button to open the rule form.
   * Handles different button variants (proxy/callout vs standard rule).
   */
  async clickCreateNewRule() {
    // Dismiss onboarding if present
    const skipBtn = this.page.locator('button:has-text("I\'ll explore myself!"), .skip-button').first();
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await this.page.waitForTimeout(500);
    }

    // Wait for the rules section to load
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);

    // Try to find split dropdown toggle for rule types
    const dropdownToggle = this.page.locator('.dropdown-toggle-split, button:has-text("Toggle Dropdown")').first();
    if (await dropdownToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdownToggle.click();
      await this.page.waitForTimeout(500);
      const newCalloutRule = this.page.locator('a:has-text("New Callout Rule"), .dropdown-item:has-text("Callout")').first();
      await newCalloutRule.click();
    } else {
      // Fallback to generic "Create New Rule" or "New Rule" button
      const createRuleBtn = this.page.locator('#createNew, button:has-text("New Rule"), button:has-text("Create New Rule")').first();
      await createRuleBtn.click();
    }

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Configure the request matching criteria for the rule.
   * @param {Object} options
   * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
   * @param {string} options.path - URL path to match (e.g., '/webhook')
   */
  async configureMatchingCriteria({ method = 'POST', path = '/webhook' }) {
    // Select HTTP Method from dropdown
    const methodDropdown = this.page.locator(
      'select:near(:text("Method")), select[name*="method" i], select[id*="method" i], select.method-select'
    );
    if (await methodDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
      await methodDropdown.first().selectOption({ label: method });
    } else {
      // Try clicking a method button/dropdown
      const methodButton = this.page.locator(`text=${method}`).first();
      if (await methodButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await methodButton.click();
      }
    }

    // Fill the request path
    const pathInput = this.page.locator(
      'input[name*="path" i], input[placeholder*="path" i], input[id*="path" i], input[placeholder*="route" i], input[name*="route" i]'
    );
    if (await pathInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pathInput.first().clear();
      await pathInput.first().fill(path);
    }
  }

  /**
   * Configure the mock response settings.
   * @param {Object} options
   * @param {number} options.statusCode - HTTP status code (e.g., 202)
   * @param {string} options.responseBody - Response body content (JSON string)
   * @param {string} [options.contentType] - Content-Type header
   */
  async configureResponse({ statusCode = 202, responseBody = '', contentType = 'application/json' }) {
    // Set status code
    const statusInput = this.page.locator(
      'input[name*="status" i], input[id*="status" i], input[placeholder*="status" i], input[type="number"]:near(:text("Status"))'
    );
    if (await statusInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusInput.first().clear();
      await statusInput.first().fill(String(statusCode));
    }

    // Set response body - could be a textarea or code editor
    const bodyEditor = this.page.locator(
      'textarea[name*="body" i], textarea[name*="response" i], textarea[id*="body" i], .response-body textarea, .CodeMirror textarea, textarea[placeholder*="response" i]'
    );
    if (await bodyEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bodyEditor.first().clear();
      await bodyEditor.first().fill(responseBody);
    } else {
      // Try CodeMirror editor (common in web apps)
      const codeMirror = this.page.locator('.CodeMirror');
      if (await codeMirror.isVisible({ timeout: 2000 }).catch(() => false)) {
        await codeMirror.first().click();
        // Select all and replace
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.type(responseBody);
      }
    }
  }

  /**
   * Configure the HTTP Callout (Asynchronous Request) settings.
   * This is the key configuration for the HTTP Callout rule.
   * @param {Object} options
   * @param {string} options.targetUrl - The URL to call out to
   * @param {string} [options.method] - HTTP method for the callout
   * @param {string} [options.calloutBody] - Body/payload for the callout
   */
  async configureHttpCallout({ targetUrl, method = 'POST', calloutBody = '' }) {
    // Find and expand the HTTP Callout accordion section
    const calloutAccordion = this.page.locator('button:has-text("HTTP Callout"), button:has-text("Request Configuration"), .accordion-button').filter({ hasText: /Callout|Request/i }).first();
    if (await calloutAccordion.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isCollapsed = await calloutAccordion.getAttribute('class').then(c => c ? c.includes('collapsed') : true);
      if (isCollapsed) {
        await calloutAccordion.click();
        await this.page.waitForTimeout(1000);
      }
    }

    // Fill the Target URL
    const targetUrlInput = this.page.locator('input[placeholder*="http" i], input[name*="target" i], input[placeholder*="target" i], #targetUrl').first();
    await targetUrlInput.waitFor({ state: 'visible', timeout: 5000 });
    await targetUrlInput.clear();
    await targetUrlInput.fill(targetUrl);

    // Select the callout method from the second #matchMethod dropdown (first is rule trigger method)
    const calloutMethodDropdown = this.page.locator('#matchMethod').nth(1);
    if (await calloutMethodDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await calloutMethodDropdown.selectOption({ label: method });
    }

    // Configure payload transformation if custom body is provided
    const transformDropdown = this.page.locator('#no-transform').first();
    if (await transformDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (calloutBody) {
        await transformDropdown.selectOption({ value: 'custom' }); // Build a custom payload
        await this.page.waitForTimeout(500);
        
        // Fill custom callout body/payload
        const calloutBodyInput = this.page.locator('textarea:near(:text("Payload")), textarea[name*="callout" i], textarea[placeholder*="{" i]').first();
        if (await calloutBodyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await calloutBodyInput.clear();
          await calloutBodyInput.fill(calloutBody);
        }
      } else {
        await transformDropdown.selectOption({ value: 'original' }); // Forward original payload
      }
    }
  }

  /** Save the rule configuration */
  async saveRule() {
    const saveButton = this.page.locator('#saveProxy, #saveCrud, button:has-text("Save"), button:has-text("Create Rule")').first();
    await saveButton.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
  }

  /**
   * Check if a rule with a specific path exists in the rules list.
   * @param {string} path - The path to look for
   * @returns {Promise<boolean>}
   */
  async ruleExists(path) {
    const rule = this.page.locator(`text=${path}`);
    return await rule.isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * Delete a rule by its path.
   * @param {string} path - The path of the rule to delete
   */
  async deleteRule(path) {
    try {
      // Find the rule row/card containing the path
      const ruleRow = this.page.locator(`text=${path}`).first();

      // Look for a delete button near the rule
      const deleteButton = this.page.locator(
        `button:has-text("Delete"):near(:text("${path}")), .delete-btn:near(:text("${path}")), [aria-label="Delete"]:near(:text("${path}")), button.btn-danger:near(:text("${path}"))` 
      );

      if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteButton.first().click();
        await this.page.waitForTimeout(500);

        // Handle confirmation dialog
        const confirmButton = this.page.locator(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete"):visible'
        );
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.first().click();
        }

        await this.page.waitForLoadState('networkidle');
      }
    } catch (error) {
      console.log(`Could not delete rule with path ${path}:`, error.message);
    }
  }

  /**
   * Complete workflow to create an HTTP Callout rule.
   * @param {Object} config
   * @param {string} config.matchMethod - HTTP method to match
   * @param {string} config.matchPath - URL path to match
   * @param {number} config.responseStatus - Status code for immediate response
   * @param {string} config.responseBody - Body for immediate response
   * @param {string} config.calloutTargetUrl - Target URL for the HTTP Callout
   * @param {string} [config.calloutMethod] - Method for the callout
   * @param {string} [config.calloutBody] - Body for the callout
   */
  async createHttpCalloutRule(config) {
    await this.clickCreateNewRule();
    await this.configureMatchingCriteria({
      method: config.matchMethod,
      path: config.matchPath,
    });
    await this.configureResponse({
      statusCode: config.responseStatus,
      responseBody: config.responseBody,
    });
    await this.configureHttpCallout({
      targetUrl: config.calloutTargetUrl,
      method: config.calloutMethod || 'POST',
      calloutBody: config.calloutBody || '',
    });
    await this.saveRule();
  }
}

module.exports = { MockRulePage };
