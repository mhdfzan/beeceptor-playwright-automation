// @ts-check

/**
 * Page Object — Beeceptor Mock Rule editor (with HTTP Callout support).
 *
 * The Beeceptor rules editor is a Bootstrap-style modal/panel that renders
 * two different variants depending on rule type:
 *   • Standard mock rule  (returns a canned response)
 *   • Callout / Proxy rule (returns a response AND fires an outbound request)
 *
 * This POM covers the callout flow end to end.
 */
class MockRulePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  /**
   * Open the "New Callout Rule" form. Handles both the split-dropdown UI
   * and the plain "Create New Rule" button variants.
   */
  async openNewCalloutRuleForm() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);

    let opened = false;

    // Preferred path: split-dropdown caret — locate the button-group that
    // contains a "New Rule" button, then pick the caret (last button in it).
    const newRuleGroup = this.page
      .locator('.btn-group, .input-group, div')
      .filter({ has: this.page.locator('button:has-text("New Rule")') })
      .first();

    let caret = newRuleGroup
      .locator(
        'button.dropdown-toggle-split, button[data-bs-toggle="dropdown"], button[aria-haspopup="true"]',
      )
      .first();

    // If no scoped caret found, fall back to any split-toggle on the page.
    if (!(await caret.isVisible({ timeout: 1_500 }).catch(() => false))) {
      caret = this.page
        .locator(
          'button.dropdown-toggle-split, button[data-bs-toggle="dropdown"][aria-expanded="false"]',
        )
        .last();
    }

    if (await caret.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await caret.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500);
      const calloutItem = this.page
        .locator('.dropdown-menu a, .dropdown-menu button, .dropdown-item, li a, li button')
        .filter({ hasText: /Callout|Proxy/i })
        .first();
      if (await calloutItem.isVisible({ timeout: 2_500 }).catch(() => false)) {
        await calloutItem.click({ force: true }).catch(() => {});
        opened = true;
      }
    }

    // Fallback: plain "+ New Rule" / "Create New Rule" button
    if (!opened) {
      const createBtn = this.page
        .locator(
          '#createNew, button:has-text("+ New Rule"), button:has-text("Create New Rule"), button:has-text("New Rule")',
        )
        .first();
      if (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await createBtn.click({ force: true });
        opened = true;
      }
    }

    if (!opened) {
      throw new Error(
        'Could not open the "New Rule" form — no dropdown-toggle or #createNew button found.',
      );
    }

    // Wait for the trigger-method select to be at least attached to the DOM.
    // Some Bootstrap variants leave the native <select> visually hidden but
    // Playwright's selectOption() still operates on it.
    await this.page.locator('#matchMethod').first().waitFor({ state: 'attached', timeout: 15_000 });
    await this.page.waitForTimeout(800);
  }

  /**
   * Set the incoming-request matching criteria.
   * @param {{method: string, path: string}} opts
   */
  async setMatchCriteria({ method, path }) {
    // The first #matchMethod dropdown is the trigger method; second is the
    // callout's outbound method. Beeceptor uses the same ID for both — we
    // rely on ordering.
    //
    // Note: 'attached' (not 'visible') — Bootstrap's form-select styling
    // sometimes hides the native <select>, but Playwright can still call
    // .selectOption() on hidden selects.
    const triggerMethod = this.page.locator('#matchMethod').first();
    await triggerMethod.waitFor({ state: 'attached', timeout: 10_000 });
    await triggerMethod.selectOption({ label: method });

    const pathInput = this.page
      .locator('input[name*="path" i], input[placeholder*="path" i], input#matchPath')
      .first();
    await pathInput.waitFor({ state: 'attached', timeout: 5_000 });
    await pathInput.fill(path);
  }

  /**
   * Set the immediate mock response returned to the original caller.
   * @param {{statusCode: number, body?: string}} opts
   */
  async setImmediateResponse({ statusCode, body = '' }) {
    const statusInput = this.page
      .locator('input[name*="status" i], input#responseStatus, input[type="number"]')
      .first();
    if (await statusInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusInput.fill(String(statusCode));
    }

    if (body) {
      const bodyArea = this.page
        .locator('textarea[name*="body" i], textarea[id*="body" i], textarea.response-body')
        .first();
      if (await bodyArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await bodyArea.fill(body);
      }
    }
  }

  /**
   * Configure the outbound HTTP Callout (Async Request) — the feature under test.
   * @param {{targetUrl:string, method:string, calloutBody?:string}} opts
   */
  async setHttpCallout({ targetUrl, method = 'POST', calloutBody = '' }) {
    // Expand the HTTP Callout / outbound-request accordion if collapsed
    const accordion = this.page
      .locator('button.accordion-button, .accordion-header button')
      .filter({ hasText: /Callout|Outbound|Async(hronous)? Request|Request Configuration/i })
      .first();
    if (await accordion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const cls = (await accordion.getAttribute('class')) || '';
      if (cls.includes('collapsed')) {
        await accordion.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }

    // Target URL
    const targetUrlInput = this.page
      .locator('#targetUrl, input[name="targetUrl" i], input[placeholder*="http" i]')
      .first();
    await targetUrlInput.waitFor({ state: 'attached', timeout: 5_000 });
    await targetUrlInput.fill(targetUrl);

    // Callout method — second #matchMethod on the page
    const calloutMethod = this.page.locator('#matchMethod').nth(1);
    if (await calloutMethod.count()) {
      await calloutMethod.selectOption({ label: method }).catch(() => {});
    }

    // Payload transform dropdown
    const transform = this.page.locator('#no-transform').first();
    if (await transform.count()) {
      if (calloutBody) {
        await transform.selectOption({ value: 'custom' }).catch(() => {});
        await this.page.waitForTimeout(400);
        const bodyInput = this.page
          .locator('textarea[name*="callout" i], textarea[placeholder*="{" i]')
          .first();
        if (await bodyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await bodyInput.fill(calloutBody);
        }
      } else {
        await transform.selectOption({ value: 'original' }).catch(() => {});
      }
    }
  }

  /** Persist the rule (calls the appropriate Save button). */
  async save() {
    const save = this.page
      .locator('#saveProxy, #saveCrud, button:has-text("Save"):visible')
      .first();
    await save.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_500);
  }

  /**
   * Complete flow — open form, fill everything, save.
   * @param {import('../utils/config').config['calloutRule']} rule
   */
  async createHttpCalloutRule(rule) {
    await this.openNewCalloutRuleForm();
    await this.setMatchCriteria({ method: rule.matchMethod, path: rule.matchPath });
    await this.setImmediateResponse({
      statusCode: rule.responseStatus,
      body: rule.responseBody,
    });
    await this.setHttpCallout({
      targetUrl: rule.calloutTargetUrl,
      method: rule.calloutMethod,
      calloutBody: rule.calloutBody,
    });
    await this.save();
  }

  /**
   * Is a rule matching `pathFragment` visible in the rules list?
   * @param {string} pathFragment
   */
  async ruleExists(pathFragment) {
    const rule = this.page.locator(`text=${pathFragment}`).first();
    return rule.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /**
   * Delete a rule row by locating its path text and clicking a nearby delete.
   * Best-effort — Beeceptor's DOM changes; we tolerate failures.
   * @param {string} pathFragment
   */
  async deleteRule(pathFragment) {
    try {
      const row = this.page.locator(`text=${pathFragment}`).first();
      if (!(await row.isVisible({ timeout: 3_000 }).catch(() => false))) return;

      const delBtn = row
        .locator('xpath=ancestor::*[self::tr or self::li or self::div][1]')
        .locator('button:has-text("Delete"), .btn-danger, [aria-label*="delete" i]')
        .first();

      if (await delBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await delBtn.click();
        this.page.on('dialog', (d) => d.accept().catch(() => {}));
        const confirm = this.page
          .locator(
            'button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Delete"):visible',
          )
          .first();
        if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await confirm.click();
        }
        await this.page.waitForLoadState('networkidle');
      }
    } catch (err) {
      console.log(`ℹ  Rule delete skipped for "${pathFragment}": ${err.message}`);
    }
  }
}

module.exports = { MockRulePage };
