// @ts-check
require('dotenv').config();

/**
 * Central configuration for the Beeceptor Playwright automation.
 * All URLs, credentials, timeouts, and defaults in one place.
 */
const config = {
  // Beeceptor URLs
  urls: {
    home: 'https://beeceptor.com',
    login: 'https://app.beeceptor.com/login',
    console: 'https://app.beeceptor.com/console',
  },

  // Credentials from environment variables
  credentials: {
    email: process.env.BEECEPTOR_EMAIL || '',
    password: process.env.BEECEPTOR_PASSWORD || '',
  },

  // Endpoint configuration
  endpoint: {
    /** Generate a unique endpoint name with timestamp */
    generateName: () => {
      const timestamp = Date.now();
      return `pw-test-${timestamp}`;
    },
    /** Get the full endpoint URL */
    getUrl: (name) => `https://${name}.free.beeceptor.com`,
  },

  // HTTP Callout rule defaults
  calloutRule: {
    matchMethod: 'POST',
    matchPath: '/webhook',
    responseStatus: 202,
    responseBody: JSON.stringify({
      status: 'accepted',
      message: 'Request received. Processing asynchronously.',
      timestamp: '{{now}}',
    }, null, 2),
    calloutTargetUrl: 'https://httpbin.org/post',
    calloutMethod: 'POST',
    calloutBody: JSON.stringify({
      source: 'beeceptor-automation',
      event: 'webhook_received',
      originalPath: '{{reqPath}}',
    }, null, 2),
  },

  // Timeouts
  timeouts: {
    navigation: 30000,
    action: 15000,
    assertion: 10000,
    apiCall: 10000,
    pollInterval: 1000,
    maxPollTime: 15000,
  },
};

module.exports = { config };
