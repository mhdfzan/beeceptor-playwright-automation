// @ts-check

/**
 * Lightweight HTTP client wrapper around Playwright's APIRequestContext.
 *
 * Used to trigger Beeceptor endpoints from tests without spinning up a
 * separate browser context — same request infrastructure, cleaner API.
 */
class ApiHelper {
  /**
   * @param {import('@playwright/test').APIRequestContext} request
   */
  constructor(request) {
    this.request = request;
  }

  /**
   * Send an HTTP request to any URL and return a normalized response.
   *
   * @param {Object} options
   * @param {string} options.url
   * @param {string} [options.method='POST']
   * @param {Object|string|null} [options.body]
   * @param {Object} [options.headers]
   * @returns {Promise<{status: number, ok: boolean, body: any, headers: Object}>}
   */
  async send({ url, method = 'POST', body = null, headers = {} }) {
    const options = {
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body !== null && body !== undefined) {
      options.data = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await this.request.fetch(url, {
      method: method.toUpperCase(),
      ...options,
    });

    let parsedBody;
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = await response.text();
    }

    return {
      status: response.status(),
      ok: response.ok(),
      body: parsedBody,
      headers: response.headers(),
    };
  }

  /**
   * Convenience — trigger a Beeceptor endpoint at `${endpointUrl}${path}`.
   *
   * @param {string} endpointUrl
   * @param {string} path
   * @param {Object} payload
   * @param {string} [method='POST']
   */
  async triggerEndpoint(endpointUrl, path, payload = {}, method = 'POST') {
    const fullUrl = `${endpointUrl}${path}`;
    return this.send({ url: fullUrl, method, body: payload });
  }
}

module.exports = { ApiHelper };
