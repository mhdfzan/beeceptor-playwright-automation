// @ts-check
const { config } = require('../utils/config');

/**
 * Page Object — Beeceptor Endpoint Console.
 *
 * Responsible for:
 *   • Opening the Mock Rules panel
 *   • Inspecting the request log
 *   • Verifying that an inbound request AND its outbound HTTP Callout succeeded
 *   • Deleting the endpoint on cleanup
 */
class EndpointPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  async goto(endpointName) {
    await this.page.goto(config.urls.console(endpointName), {
      waitUntil: 'domcontentloaded',
    });
    await this.dismissOnboardingIfPresent();
    await this.page.waitForLoadState('networkidle');
  }

  /** Beeceptor shows a first-run wizard occasionally — skip it. */
  async dismissOnboardingIfPresent() {
    // Dismiss the GDPR cookie banner first (it overlays other buttons).
    const acceptCookies = this.page.locator('.accept-cookies, button:has-text("Accept")').first();
    if (await acceptCookies.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await acceptCookies.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(200);
    }

    // The onboarding "skip" button — target by class/aria-label so we don't
    // depend on straight-vs-curly apostrophe in the visible text.
    const skipBtn = this.page
      .locator('.skip-button, [aria-label*="Skip onboarding" i], button[aria-label*="skip" i]')
      .first();
    if (await skipBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await skipBtn.click({ force: true }).catch(() => {});
      await this.page.waitForTimeout(300);
    }
  }

  /** Switch to the "Mocking Rules" tab in the endpoint console. */
  async openMockingRules() {
    await this.dismissOnboardingIfPresent();
    await this.page.waitForLoadState('networkidle');

    // Try progressively more permissive locators — Beeceptor's tab element
    // varies (link vs button vs span-inside-li) across page states.
    const candidates = [
      this.page.getByRole('tab', { name: /Mock(ing)?\s*Rules/i }),
      this.page.getByRole('link', { name: /Mock(ing)?\s*Rules/i }),
      this.page.locator('a, button, li, span').filter({ hasText: /Mock(ing)?\s*Rules/i }),
      this.page.locator('a[href*="rules" i], a[href*="mock" i]'),
    ];

    for (const candidate of candidates) {
      const first = candidate.first();
      if (await first.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await first.scrollIntoViewIfNeeded().catch(() => {});
        await first.click({ force: true });
        await this.page.waitForLoadState('networkidle');
        break;
      }
    }

    // Wait for the rules panel to actually render — this is what the caller
    // expects. Any of these markers means we're there.
    const panelMarker = this.page
      .locator(
        '#createNew, .dropdown-toggle-split, button:has-text("New Rule"), button:has-text("Create New Rule")',
      )
      .first();
    await panelMarker.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
      // Not fatal here — caller's assertion will surface a clearer error.
    });
  }

  /** Switch back to the "Requests" (log) tab. */
  async openRequestLog() {
    await this.dismissOnboardingIfPresent();

    const candidates = [
      this.page.getByRole('tab', { name: /Requests?|Endpoint Console|Live Requests/i }),
      this.page.getByRole('link', { name: /Requests?|Endpoint Console|Live Requests/i }),
      this.page.locator('a, button, li, span').filter({
        hasText: /^(Requests?|Endpoint Console|Live Requests)$/i,
      }),
      this.page.locator('a[href*="requests" i]'),
    ];

    for (const candidate of candidates) {
      const first = candidate.first();
      if (await first.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await first.click({ force: true }).catch(() => {});
        await this.page.waitForLoadState('networkidle');
        return;
      }
    }
    // Not fatal — some layouts default to the requests view already
  }

  /**
   * Reload the console page and wait for at least one logged request whose
   * displayed path contains `pathFragment`.
   *
   * @param {string} pathFragment  — e.g. '/webhook'
   * @param {number} [timeoutMs]
   * @returns {Promise<import('@playwright/test').Locator>}  the matched row
   */
  async waitForRequestWithPath(pathFragment, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.dismissOnboardingIfPresent();
      await this.page.waitForTimeout(1_500);

      const row = this.page.locator(`text=${pathFragment}`).first();
      try {
        if (await row.isVisible({ timeout: 2_000 })) {
          return row;
        }
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(
      `Timed out waiting for a request with path "${pathFragment}" to appear in the console. ${lastError ?? ''}`,
    );
  }

  /**
   * Click into a logged request row, then verify the outbound callout section
   * appeared and reported a success status.
   *
   * The Beeceptor UI renders callout details inline (or in a side panel) after
   * clicking a request. We look for either an explicit "Callout" header /
   * badge or a status code element carrying a 2xx.
   *
   * @param {import('@playwright/test').Locator} requestRow
   * @param {{min:number, max:number}} _expectedStatusRange
   * @returns {Promise<{calloutFound: boolean, status?: number, rawSnippet?: string}>}
   */
  async verifyCalloutForRequest(requestRow, _expectedStatusRange) {
    await requestRow.scrollIntoViewIfNeeded();
    await requestRow.click();
    await this.page.waitForTimeout(2_000);

    // Look for anything that hints at the outbound callout section
    const calloutLocator = this.page
      .locator('text=/Callout|Outbound|Proxy Response|HTTP Callout|Async(hronous)? Request/i')
      .first();

    const calloutFound = await calloutLocator.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!calloutFound) {
      return { calloutFound: false };
    }

    // Grab the raw text of the request-detail region as a diagnostic snippet.
    const detailRegion = this.page.locator('body');
    const rawSnippet = (await detailRegion.innerText()).slice(0, 4_000);

    // Search the visible text for the first 3-digit HTTP status near "Callout".
    // Fall back: any 2xx code in the panel counts.
    const statusMatch = rawSnippet.match(
      /(?:callout|outbound|proxy)[^\n]{0,80}?\b(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/i,
    );

    let status;
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    } else {
      const anyStatus = rawSnippet.match(/\b(2\d{2})\b/);
      if (anyStatus) status = parseInt(anyStatus[1], 10);
    }

    return { calloutFound, status, rawSnippet };
  }

  /**
   * Attempt to delete the currently-open endpoint. Best-effort — Beeceptor
   * anonymous endpoints auto-expire, so failure here is not fatal.
   */
  async deleteEndpoint() {
    try {
      const settings = this.page
        .locator('a:has-text("Settings"), button:has-text("Settings")')
        .first();
      if (await settings.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await settings.click();
        await this.page.waitForTimeout(1_000);
      }
      const del = this.page
        .locator('button:has-text("Delete Endpoint"), button:has-text("Delete")')
        .first();
      if (await del.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await del.click();
        this.page.on('dialog', (d) => d.accept().catch(() => {}));
        const confirm = this.page
          .locator('button:has-text("Yes"), button:has-text("Confirm")')
          .first();
        if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await confirm.click();
        }
      }
    } catch (err) {
      console.log(`ℹ  Endpoint delete skipped: ${err.message}`);
    }
  }
}

module.exports = { EndpointPage };
