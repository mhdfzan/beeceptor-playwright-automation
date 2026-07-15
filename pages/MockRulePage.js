// @ts-check

/**
 * Page Object — Beeceptor Callout Rule editor.
 *
 * The rule form (opened by clicking the split-dropdown caret → "New
 * Callout Rule") has two collapsible sections:
 *
 *   1. "When following condition is matched (for request)"  — match criteria
 *   2. "Do the following (for response)"                     — response + callout
 *        ├─ Synchronous Response Configuration
 *        └─ Synchronous Request Configuration (HTTP Callout)
 *
 * We target fields by their visible label text (via getByLabel) so the
 * selectors survive class-name reshuffles.
 */
class MockRulePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  /**
   * Open the "New Callout Rule" form via the split-dropdown caret.
   * Falls back to "+ New Rule" (which opens the mock form) if the caret
   * or callout option cannot be located.
   */
  async openNewCalloutRuleForm() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(800);

    const newRuleBtn = this.page.locator('button:has-text("New Rule")').first();
    await newRuleBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // Diagnostic: "before" state.
    await this.page
      .screenshot({ path: 'test-results/before-open-form.png', fullPage: true })
      .catch(() => {});

    const caret = newRuleBtn.locator('xpath=following-sibling::button[1]');
    let openedViaCallout = false;

    if (await caret.count()) {
      await caret.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(700);
      const calloutItem = this.page
        .locator('.dropdown-menu a, .dropdown-menu button, .dropdown-item, li a, li button')
        .filter({ hasText: /New Callout Rule|Callout Rule|Callout/i })
        .first();
      if (await calloutItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await calloutItem.click({ force: true });
        openedViaCallout = true;
      }
    }

    if (!openedViaCallout) {
      console.log(
        'ℹ  Falling back to "+ New Rule" (mock form) — caret + callout flow did not work.',
      );
      await newRuleBtn.click({ force: true });
    }

    // Let the modal animate open before we probe for fields.
    await this.page.waitForTimeout(2_000);
    await this.page
      .screenshot({ path: 'test-results/after-open-form.png', fullPage: true })
      .catch(() => {});

    // Wait for the trigger-method select to be attached to the DOM. This is
    // present in both mock and callout forms. Bootstrap may leave it visually
    // hidden — that's OK, Playwright's selectOption() still operates on it.
    await this.page
      .locator('#matchMethod, select[name*="matchMethod" i]')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 });
  }

  /**
   * Set the incoming-request matching criteria at the top of the form.
   * @param {{method: string, path: string}} opts
   */
  async setMatchCriteria({ method, path }) {
    // Trigger-method select. First #matchMethod on the page.
    const triggerMethod = this.page.locator('#matchMethod, select[name*="matchMethod" i]').first();
    await triggerMethod.waitFor({ state: 'attached', timeout: 10_000 });
    await triggerMethod.selectOption({ label: method }).catch(async () => {
      await triggerMethod.selectOption(method).catch(() => {});
    });

    // Path input — Beeceptor labels this "Match value/expression".
    // Try common IDs first, then broad attribute/placeholder matches.
    const pathSelectors = [
      '#matchPath',
      '#matchValue',
      '#matchExpression',
      'input[name="matchPath" i]',
      'input[name="matchValue" i]',
      'input[name*="match" i]',
      'input[placeholder*="path" i]',
      'input[placeholder*="pattern" i]',
      'input[placeholder*="expression" i]',
      'input[placeholder*="/" i]',
    ].join(', ');

    const pathInput = this.page.locator(pathSelectors).first();
    if (await pathInput.count()) {
      await pathInput.fill(path).catch(() => {});
    }

    // Verify the value stuck; if not, try a broader approach — the first
    // text-like input near a label containing "Match".
    if (await pathInput.count()) {
      const filled = await pathInput.inputValue().catch(() => '');
      if (filled !== path) {
        const nearMatchLabel = this.page
          .locator('label')
          .filter({ hasText: /Match/i })
          .first()
          .locator('xpath=following::input[1]');
        if (await nearMatchLabel.count()) {
          await nearMatchLabel.fill(path).catch(() => {});
        }
      }
    }
  }

  /**
   * Configure the outbound HTTP Callout — the feature under test.
   * @param {{targetUrl:string, method:string, calloutBody?:string}} opts
   */
  async setHttpCallout({ targetUrl, method = 'POST', calloutBody = '' }) {
    // Expand the "Synchronous Request Configuration (HTTP Callout)"
    // accordion if it's collapsed.
    const calloutHeader = this.page
      .locator('button, div, h2, h3, .accordion-button, .accordion-header')
      .filter({ hasText: /Synchronous Request Configuration|HTTP Callout/i })
      .first();
    if (await calloutHeader.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const cls = (await calloutHeader.getAttribute('class').catch(() => '')) || '';
      if (cls.includes('collapsed')) {
        await calloutHeader.click({ force: true }).catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }

    // Target endpoint — the URL input inside the callout section.
    const targetUrlInput = this.page
      .locator(
        '#targetUrl, input[name*="target" i], input[placeholder*="webhook-endpoint" i], input[placeholder*="your-webhook" i]',
      )
      .first();
    await targetUrlInput.waitFor({ state: 'attached', timeout: 8_000 });
    await targetUrlInput.fill(targetUrl);

    // Callout method — the second Method dropdown on the page (inside the
    // callout section). #matchMethod may be reused; pick the LAST one.
    const calloutMethod = this.page.locator('#matchMethod, select[name*="matchMethod" i]').last();
    if (await calloutMethod.count()) {
      await calloutMethod.selectOption({ label: method }).catch(async () => {
        await calloutMethod.selectOption(method).catch(() => {});
      });
    }

    // Configure payload — dropdown labeled "Configure payload".
    // Options include "Forward original payload" and "Configure custom payload".
    const payloadSelect = this.page
      .locator('#no-transform, select[name*="transform" i], select[name*="payload" i]')
      .first();
    if (await payloadSelect.count()) {
      if (calloutBody) {
        await payloadSelect
          .selectOption({ label: /custom/i })
          .catch(() => payloadSelect.selectOption({ value: 'custom' }))
          .catch(() => {});
        await this.page.waitForTimeout(400);
        const bodyInput = this.page
          .locator('textarea[name*="payload" i], textarea[name*="callout" i], textarea')
          .last();
        if (await bodyInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await bodyInput.fill(calloutBody).catch(() => {});
        }
      } else {
        // Default "Forward original payload" — already selected; no-op.
      }
    }
  }

  /** Persist the rule. Beeceptor callout rules use #saveProxy. */
  async save() {
    // Diagnostic screenshot — captures the filled form right before save.
    await this.page
      .screenshot({ path: 'test-results/pre-save-form.png', fullPage: true })
      .catch(() => {});

    // Prefer the specific #saveProxy id used by callout rules.
    const saveById = this.page.locator('#saveProxy').first();
    if (await saveById.count().catch(() => 0)) {
      await saveById.scrollIntoViewIfNeeded().catch(() => {});
      await saveById.click({ force: true });
    } else {
      // Otherwise find the Save button inside the last-opened modal/dialog.
      const modalSave = this.page
        .locator('.modal, [role="dialog"], .modal-dialog, .offcanvas')
        .last()
        .locator('button')
        .filter({ hasText: /^\s*Save\s*$/i })
        .first();

      if (await modalSave.count().catch(() => 0)) {
        await modalSave.scrollIntoViewIfNeeded().catch(() => {});
        await modalSave.click({ force: true });
      } else {
        // Last resort — the last visible Save button on the page.
        const anySave = this.page.locator('button:has-text("Save"):visible').last();
        await anySave.scrollIntoViewIfNeeded().catch(() => {});
        await anySave.click({ force: true });
      }
    }

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2_000);
    await this.page
      .screenshot({ path: 'test-results/post-save-form.png', fullPage: true })
      .catch(() => {});
  }

  /** Complete flow. */
  async createHttpCalloutRule(rule) {
    await this.openNewCalloutRuleForm();
    await this.setMatchCriteria({ method: rule.matchMethod, path: rule.matchPath });
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
        .locator(
          'button:has-text("Delete"), .btn-danger, [aria-label*="delete" i], [title*="delete" i]',
        )
        .first();

      if (await delBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        this.page.on('dialog', (d) => d.accept().catch(() => {}));
        await delBtn.click({ force: true });
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
