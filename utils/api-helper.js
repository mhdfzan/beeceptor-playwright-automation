// @ts-check

/**
 * API Helper for triggering Beeceptor endpoints and verifying responses.
 * Uses Playwright's built-in request context for HTTP calls.
 */
class ApiHelper {
  /**
   * @param {import('@playwright/test').APIRequestContext} request - Playwright request context
   */
  constructor(request) {
    this.request = request;
  }

  /**
   * Trigger a Beeceptor endpoint with an HTTP request.
   * @param {Object} options
   * @param {string} options.url - Full URL to send the request to
   * @param {string} [options.method='POST'] - HTTP method
   * @param {Object|string} [options.body] - Request body
   * @param {Object} [options.headers] - Additional headers
   * @returns {Promise<{status: number, body: any, headers: Object}>}
   */
  async triggerEndpoint({ url, method = 'POST', body = null, headers = {} }) {
    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      requestOptions.data = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let response;
    switch (method.toUpperCase()) {
      case 'GET':
        response = await this.request.get(url, requestOptions);
        break;
      case 'POST':
        response = await this.request.post(url, requestOptions);
        break;
      case 'PUT':
        response = await this.request.put(url, requestOptions);
        break;
      case 'PATCH':
        response = await this.request.patch(url, requestOptions);
        break;
      case 'DELETE':
        response = await this.request.delete(url, requestOptions);
        break;
      default:
        response = await this.request.post(url, requestOptions);
    }

    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text();
    }

    return {
      status: response.status(),
      body: responseBody,
      headers: response.headers(),
    };
  }

  /**
   * Send a POST request to trigger a webhook-style endpoint.
   * @param {string} endpointUrl - The Beeceptor endpoint base URL
   * @param {string} path - The path to trigger (e.g., '/webhook')
   * @param {Object} payload - The JSON payload to send
   * @returns {Promise<{status: number, body: any, headers: Object}>}
   */
  async triggerWebhook(endpointUrl, path, payload = {}) {
    const fullUrl = `${endpointUrl}${path}`;
    console.log(`Triggering webhook: POST ${fullUrl}`);
    return await this.triggerEndpoint({
      url: fullUrl,
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Verify the response matches expected values.
   * @param {Object} response - The response from triggerEndpoint
   * @param {Object} expected
   * @param {number} [expected.status] - Expected status code
   * @param {Object} [expected.bodyContains] - Key-value pairs the body should contain
   * @returns {Object} Verification results
   */
  verifyResponse(response, expected = {}) {
    const results = {
      statusMatch: true,
      bodyMatch: true,
      details: [],
    };

    if (expected.status !== undefined) {
      results.statusMatch = response.status === expected.status;
      results.details.push(
        `Status: expected ${expected.status}, got ${response.status} - ${results.statusMatch ? 'PASS' : 'FAIL'}`
      );
    }

    if (expected.bodyContains && typeof response.body === 'object') {
      for (const [key, value] of Object.entries(expected.bodyContains)) {
        const match = response.body[key] === value;
        if (!match) results.bodyMatch = false;
        results.details.push(
          `Body.${key}: expected "${value}", got "${response.body[key]}" - ${match ? 'PASS' : 'FAIL'}`
        );
      }
    }

    return results;
  }
}

module.exports = { ApiHelper };
