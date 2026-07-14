# 🐝 Beeceptor HTTP Callout Rule — Playwright Automation

Automated end-to-end testing of [Beeceptor's HTTP Callout Rule](https://beeceptor.com/docs/proxy-rule-http-callout/) feature using [Playwright](https://playwright.dev/) (JavaScript).

---

## 📖 Understanding the HTTP Callout Feature

### What is it?
Beeceptor's **HTTP Callout Rule** (also called Proxy Rule) is a powerful mock rule that, when triggered by an incoming HTTP request, simultaneously:

1. **Returns an immediate response** to the original caller (e.g., `202 Accepted`)
2. **Fires an outbound HTTP request** (callout) to an external service in the background

### When to use it?
- **Simulating async workflows**: Webhooks, payment callbacks, SMS delivery notifications
- **Integration testing**: Testing how your app handles multi-service interactions
- **Payload transformation**: Forwarding modified request data to downstream services
- **Dynamic routing**: Routing requests to different backends based on payload content

### How it works
```
Client ──POST /webhook──► Beeceptor Endpoint
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          Returns 202 to          Fires POST to
          original client       httpbin.org/post
          (immediate)            (background callout)
```

---

## 🏗️ Project Architecture

```
beeceptor-playwright-automation/
├── playwright.config.js        # Playwright configuration (browser, video, timeouts)
├── package.json                # Dependencies & npm scripts
├── .env.example                # Environment variable template
├── .gitignore                  # Git ignore rules
│
├── pages/                      # Page Object Model (POM) classes
│   ├── LoginPage.js            # Authentication handling
│   ├── DashboardPage.js        # Endpoint creation & navigation
│   ├── EndpointPage.js         # Endpoint console & request logs
│   └── MockRulePage.js         # Rule creation & configuration
│
├── tests/                      # Test specifications
│   └── http-callout.spec.js    # Main E2E test suite (8 steps)
│
├── utils/                      # Shared utilities
│   ├── config.js               # Centralized configuration
│   └── api-helper.js           # HTTP request helper for triggering endpoints
│
└── fixtures/                   # Playwright custom fixtures
    └── test-fixtures.js        # Page object injection
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Page Object Model** | Separates UI interaction logic from test assertions for maintainability |
| **Custom Fixtures** | Automatically injects page objects into tests — cleaner than manual instantiation |
| **Sequential Tests** | Tests run in order (login → create → configure → trigger → verify → cleanup) as they share endpoint state |
| **Resilient Locators** | Uses multiple selector strategies with fallbacks (role-based, text-based, attribute-based) since Beeceptor's CSS classes may change |
| **Environment Variables** | Credentials stored in `.env` (not committed) for security |
| **Video Recording** | Every test run is recorded — useful for debugging and demo submission |

---

## 🚀 Setup & Installation

### Prerequisites
- **Node.js** v18+ ([download](https://nodejs.org/))
- **A free Beeceptor account** ([sign up](https://beeceptor.com/))

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/beeceptor-playwright-automation.git
cd beeceptor-playwright-automation
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Install Playwright Browsers
```bash
npx playwright install chromium
```

### Step 4: Configure Environment
```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your Beeceptor credentials
# BEECEPTOR_EMAIL=your-email@example.com
# BEECEPTOR_PASSWORD=your-password
```

> **Note**: If you don't set credentials, the automation will attempt to use Beeceptor's free tier (no login required for basic endpoint creation).

---

## ▶️ Running the Tests

### Standard Run (headless)
```bash
npm test
```

### Headed Mode (see the browser)
```bash
npm run test:headed
```

### Debug Mode (step through interactively)
```bash
npm run test:debug
```

### Slow Motion (great for demos)
```bash
npm run test:slow
```

### View HTML Report
```bash
npm run report
```

---

## 🧪 Test Scenarios

The test suite covers 8 sequential steps that form a complete E2E workflow:

| Step | Test | What it does |
|------|------|-------------|
| 1 | **Login** | Authenticates with Beeceptor (skips if no credentials) |
| 2 | **Create Endpoint** | Creates a new mock endpoint with unique name |
| 3 | **Navigate to Rules** | Opens the Mocking Rules section |
| 4 | **Create Callout Rule** | Creates an HTTP Callout rule (POST /webhook → httpbin.org/post) |
| 5 | **Trigger Endpoint** | Sends POST to the endpoint to fire the callout |
| 6 | **Verify Callout** | Checks request logs confirm the callout executed |
| 7 | **Non-matching Test** | Verifies non-matching paths don't trigger the rule |
| 8 | **Cleanup** | Deletes the rule and endpoint |

### Key Assertions
- ✅ Login succeeds and dashboard is accessible
- ✅ Endpoint is created and accessible via URL
- ✅ HTTP Callout rule appears in the rules list
- ✅ API trigger returns expected status code (202)
- ✅ Request is logged in Beeceptor's request history
- ✅ Non-matching paths are handled without triggering the callout
- ✅ Test data is cleaned up after the test run

---

## 🔧 Configuration

All configurable values are centralized in [`utils/config.js`](utils/config.js):

```javascript
// HTTP Callout Rule Configuration
{
  matchMethod: 'POST',           // Match incoming POST requests
  matchPath: '/webhook',         // on the /webhook path
  responseStatus: 202,           // Return 202 Accepted immediately
  calloutTargetUrl: 'https://httpbin.org/post',  // Fire callout to httpbin
  calloutMethod: 'POST',         // Callout uses POST method
}
```

---

## 📁 Artifacts Generated

After each test run, the following are generated:

| Artifact | Location | Description |
|----------|----------|-------------|
| **Video recordings** | `test-results/` | Full browser recording of each test |
| **Screenshots** | `test-results/` | Captured on failure + verification steps |
| **HTML Report** | `playwright-report/` | Interactive test report with traces |
| **Traces** | `test-results/` | Detailed trace files for debugging |

---

## 🤔 Testing Approach & Thinking

### Why Playwright?
- **Built-in API testing**: Can make HTTP calls alongside browser automation (perfect for trigger + verify)
- **Auto-waiting**: Reduces flakiness with intelligent element waiting
- **Video & trace recording**: Built-in, no extra tooling needed
- **Modern async/await**: Clean, readable test code

### Challenges Addressed
1. **Dynamic UI**: Beeceptor's CSS classes may change → used text/role-based locators with fallbacks
2. **Async callouts**: The HTTP Callout fires asynchronously → added polling/wait logic to verify
3. **State management**: Tests share endpoint state → used `test.describe.configure({ mode: 'serial' })`
4. **Free tier limitations**: Handled gracefully — tests skip login if no credentials

### What I'd Improve With More Time
- Add visual regression testing for the Beeceptor UI
- Test with multiple browser engines (Firefox, WebKit)
- Add retry logic for flaky network-dependent steps
- Implement CI/CD pipeline (GitHub Actions) for automated test runs
- Add API-based verification via Beeceptor's Management API (Team plan)

---

## 📜 License

MIT

---

## 🙏 Acknowledgments

- [Beeceptor](https://beeceptor.com/) — Mock API platform
- [Playwright](https://playwright.dev/) — Browser automation framework
- [httpbin.org](https://httpbin.org/) — HTTP request/response testing service
