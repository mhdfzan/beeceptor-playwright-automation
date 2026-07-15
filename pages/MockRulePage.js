// @ts-check

/**
 * Page Object — Beeceptor Mock Rule editor (with HTTP Callout support).
 *
 * Beeceptor's Mock Rules modal has a split button at the bottom:
 *   [ + New Rule ][ ▼ ]
 * Clicking "+ New Rule" creates a MOCK rule. Clicking the caret opens a
 * menu with "New CRUD Route" and "New Callout Rule" — we want the latter.
 */
class MockRulePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  /**
   * Open the "New Callout Rule" form via the split-dropdown caret.
   */
  async openNewCalloutRuleForm() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);

    const newRuleBtn = this.page.locator('button:has-text("New Rule")').first();
    await newRuleBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // The caret is the button immediately following "+ New Rule" in the DOM.
    const caret = newRuleBtn.locator('xpath=following-sibling::button[1]');
    let opened = false;

    if (await caret.count()) {
      await caret.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(500);
      const calloutItem = this.page
        .locator('.dropdown-menu a, .dropdown-menu button, .dropdown-item, li a, li button')
        .filter({ hasText: /New Callout Rule|Callout Rule|Callout/i })
        .first();
      if (await calloutItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await calloutItem.click({ force: true });
        opened = true;
      }
    }

    // Fallback: click "+ New Rule" directly (opens the MOCK rule form)
    if (!opened) {
      await newRuleBtn.click({ force: true });
      opened = true;
    }

    // Wait for the rule editor to render — the Save/Cancel buttons appear
    // at the bottom of any Beeceptor rule form.
    await this.page
      .locator('button:has-text("Save"), button:has-text("Cancel")')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    await this.page.waitForTimeout(1_000);
  }

  /**
   * Set the incoming-request matching criteria (Method + Path).
   * @param {{method: string, path: string}} opts
   */
  async setMatchCriteria({ method, path }) {
    // Trigger-method select. Bootstrap's form-select styling may render the
    // native <select> visually hidden — use 'attached' + selectOption(),
    // which Playwright supports on hidden selects.
    const triggerMethod = this.page.locator('#matchMethod').first();
    await triggerMethod.waitFor({ state: 'attached', timeout: 10_000 });
    await triggerMethod.selectOption({ label: method });

    // Path / match-value input. Beeceptor's callout form labels this
    // "Match value/expression". Try a few candidate selectors.
    const pathSelectors = [
      '#matchPath',
      'input[name*="path" i]',
      'input[name*="match" i]',
      'input[placeholder*="path" i]',
      'input[placeholder*="pattern" i]',
      'input[placeholder*="expression" i]',
    ].join(', ');

    const pathInput = this.page.locator(pathSelectors).first();
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
    if (await statusInput.count()) {
      await statusInput.fill(String(statusCode)).catch(() => {});
    }

    if (body) {
      const bodyArea = this.page
        .locator('textarea[name*="body" i], textarea[id*="body" i], textarea.response-body')
        .first();
      if (await bodyArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await bodyArea.fill(body).catch(() => {});
      }
    }
  }

  /**
   * Configure the outbound HTTP Callout (the feature under test).
   * @param {{targetUrl:string, method:string, calloutBody?:string}} opts
   */
  async setHttpCallout({ targetUrl, method = 'POST', calloutBody = '' }) {
    // Expand the HTTP Callout / outbound-request accordion if collapsed.
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

    const targetUrlInput = this.page
      .locator('#targetUrl, input[name="targetUrl" i], input[placeholder*="http" i]')
      .first();
    await targetUrlInput.waitFor({ state: 'attached', timeout: 5_000 });
    await targetUrlInput.fill(targetUrl);

    // Callout method — second #matchMethod on the page (if present)
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
          await bodyInput.fill(calloutBody).catch(() => {});
        }
      } else {
        await transform.selectOption({ value: 'original' }).catch(() => {});
      }
    }
  }

  /** Persist the rule (Save button — id may be #saveProxy for callout rules). */
  async save() {
    const save = this.page
      .locator('#saveProxy, #saveCrud, button:has-text("Save"):visible')
      .first();
    await save.click({ force: true });
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1_500);
  }

  /** Full flow. */
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

  /** Is a rule matching `pathFragment` visible in the rules list? */
  async ruleExists(pathFragment) {
    const rule = this.page.locator(`text=${pathFragment}`).first();
    return rule.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /** Best-effort rule deletion by path text. */
  async deleteRule(pathFragment) {
    try {
      const row = this.page.locator(`text=${pathFragment}`).first();
      if (!(await row.isVisible({ timeout: 3_000 }).catch(() => false))) return;

      const delBtn = row
        .locator('xpath=ancestor::*[self::tr or self::li or self::div][1]')
        .locator('button:has-text("Delete"), .btn-danger, [aria-label*="delete" i]')
        .first();

      if (await delBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await delBtn.click({ force: true });
        this.page.on('dialog', (d) => d.accept().catch(() => {}));
        const confirm = this.page
          .locator(
            'button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Delete"):visible',
          )
          .first();
        if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await confirm.click({ force: true });
        }
        await this.page.waitForLoadState('networkidle');
      }
    } catch (err) {
      console.log(`ℹ  Rule delete skipped for "${pathFragment}": ${err.message}`);
    }
  }
}

module.exports = { MockRulePage };
