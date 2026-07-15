// @ts-check
require('dotenv').config();

/**
 * Central configuration for the Beeceptor Playwright automation.
 *
 * All tunable values — URLs, credentials, endpoint naming, callout rule
 * defaults and timeouts — live here so tests and page objects stay clean.
 */

const uniqueSuffix = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const config = {
  urls: {
    home: 'https://beeceptor.com',
    app: 'https://app.beeceptor.com',
    login: 'https://app.beeceptor.com/login',
    console: (name) => `https://app.beeceptor.com/console/${name}`,
  },

  credentials: {
    email: process.env.BEECEPTOR_EMAIL || '',
    password: process.env.BEECEPTOR_PASSWORD || '',
  },

  endpoint: {
    /** If provided, reuse this endpoint (avoids Beeceptor free-tier rate limits). */
    reuseName: process.env.BEECEPTOR_ENDPOINT || '',
    /** Optional — a second Beeceptor endpoint that will act as the callout target. */
    calloutTargetName: process.env.CALLOUT_TARGET_ENDPOINT || '',
    /** Generate a unique endpoint name (fresh run) or return the reused one. */
    resolveName() {
      return this.reuseName || `pw-cal-${uniqueSuffix()}`;
    },
    /** Public trigger URL for a Beeceptor endpoint. */
    triggerUrl: (name) => `https://${name}.free.beeceptor.com`,
  },

  /**
   * Default HTTP Callout rule configuration.
   * Docs: https://beeceptor.com/docs/proxy-rule-http-callout/
   */
  calloutRule: {
    matchMethod: 'POST',
    matchPath: '/webhook',
    responseStatus: 202,
    responseBody: JSON.stringify(
      {
        status: 'accepted',
        message: 'Request received. Processing asynchronously.',
      },
      null,
      2,
    ),
    /**
     * Target URL for the outbound callout.
     * Priority:
     *   1. CALLOUT_TARGET_URL env var (explicit override — highest precedence)
     *   2. CALLOUT_TARGET_ENDPOINT env var → https://<name>.free.beeceptor.com/callout-received
     *      (enables round-trip verification against a second Beeceptor endpoint)
     *   3. https://httpbin.org/post (default fallback)
     */
    get calloutTargetUrl() {
      if (process.env.CALLOUT_TARGET_URL) return process.env.CALLOUT_TARGET_URL;
      if (process.env.CALLOUT_TARGET_ENDPOINT) {
        return `https://${process.env.CALLOUT_TARGET_ENDPOINT}.free.beeceptor.com/callout-received`;
      }
      return 'https://httpbin.org/post';
    },
    /** Path suffix appended to the callout target — used only for round-trip verification. */
    calloutTargetPath: '/callout-received',
    calloutMethod: 'POST',
    /** '' means forward original payload; set to a JSON string to send a custom payload. */
    calloutBody: '',
    /** The outbound callout should return a status code in this range for the test to pass. */
    expectedCalloutStatusMin: 200,
    expectedCalloutStatusMax: 299,
  },

  timeouts: {
    navigation: 30_000,
    action: 15_000,
    assertion: 10_000,
    apiCall: 10_000,
    calloutSettle: 6_000,
  },
};

module.exports = { config };
