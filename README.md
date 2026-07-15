# Beeceptor HTTP Callout Rule — Playwright Automation

End-to-end Playwright (JavaScript) automation that exercises Beeceptor's
[HTTP Callout Rule](https://beeceptor.com/docs/proxy-rule-http-callout/)
feature from the browser and the network — creating an endpoint, authoring
a callout rule, firing a live request, and independently verifying that the
outbound callout actually executed.

![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
[![E2E](https://github.com/mhdfzan/beeceptor-playwright-automation/actions/workflows/e2e.yml/badge.svg)](https://github.com/mhdfzan/beeceptor-playwright-automation/actions/workflows/e2e.yml)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## What the HTTP Callout Rule does

When a request hits a Beeceptor endpoint that has a matching callout rule,
Beeceptor performs two things **simultaneously**:

```
       ┌─── returns the mocked response (e.g. 202 Accepted) ───► original caller
POST → │
       └─── fires an outbound HTTP request ("callout") ────────► your target URL
```

This is how you simulate async webhooks, payment callbacks, fan-out routing,
etc. — without wiring up a real backend.

**The core value proposition is the outbound callout**, which is why this
suite verifies both halves of the behaviour.

---

## What this suite covers

| #   | Step                         | What it validates                                                                                                      |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Login                        | Authenticates when credentials are supplied; skips gracefully if not.                                                  |
| 2   | Create / Reuse endpoint      | New endpoint via UI, or reuse via `BEECEPTOR_ENDPOINT` env var.                                                        |
| 3   | Open Mock Rules panel        | Robust tab navigation with onboarding-wizard dismissal.                                                                |
| 4   | Author callout rule          | Fills match criteria, response, and outbound-request configuration.                                                    |
| 5   | Trigger endpoint             | Live POST via Playwright's `APIRequestContext`; asserts 202.                                                           |
| 6   | **Verify callout fired**     | Opens the logged request in the console and asserts the outbound                                                       |
|     |                              | callout section is present and reports a success status.                                                               |
| 7   | Non-matching path            | Confirms unrelated paths do NOT hit the rule.                                                                          |
| 7b  | **Round-trip proof** _(opt)_ | With `CALLOUT_TARGET_ENDPOINT` set, opens the target endpoint's console and asserts the outbound request landed there. |
| 8   | Cleanup                      | Deletes the rule and (unless reusing) the endpoint.                                                                    |

The verification in **Step 6 is the interesting bit** — most naive tests
only check that a request was logged. This suite goes further and asserts
Beeceptor recorded the outbound callout result too.

---

## Project layout

```
beeceptor-playwright-automation/
├── .github/workflows/
│   └── e2e.yml                 # GitHub Actions — lint + e2e on push/PR
├── demo/                       # (generated) per-step videos from `npm run demo`
├── fixtures/
│   └── test-fixtures.js        # Injects page objects into every test
├── pages/                      # Page Object Model
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   ├── EndpointPage.js         # ← callout verification lives here
│   └── MockRulePage.js
├── scripts/
│   └── record-demo.js          # `npm run demo` — one-command demo recorder
├── tests/
│   └── http-callout.spec.js    # 9 sequential test steps in one serial block
├── utils/
│   ├── config.js               # All URLs, timeouts, rule defaults
│   └── api-helper.js           # Thin wrapper around Playwright's request API
├── playwright.config.js
├── package.json
├── .env.example
├── .eslintrc.json / .prettierrc.json
└── README.md
```

### Design decisions

| Decision                          | Why                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Page Object Model**             | Keeps UI selectors out of tests. One place to fix when Beeceptor's DOM shifts.                    |
| **Fixtures, not manual `new`s**   | `page`, `loginPage`, `endpointPage`, etc. arrive pre-wired to each test.                          |
| **Serial `describe`, one worker** | Beeceptor state is per-endpoint; parallelism would cause flakes.                                  |
| **Env-driven configuration**      | No secrets in the repo. Same suite runs locally, in CI, and against a reused endpoint.            |
| **Verify outbound callout in UI** | The whole point of the feature — assertion has to prove it, not just that a request was received. |
| **Video always on**               | Every run auto-produces a demo-ready recording.                                                   |
| **Trace on first retry**          | Cheap debugging in CI without huge artifacts.                                                     |
| **ESLint + Prettier + CI**        | Signals production-readiness; lint gate blocks bad merges.                                        |

---

## Getting started

### Prerequisites

- **Node.js ≥ 18**
- (Optional) a free Beeceptor account — sign up at <https://beeceptor.com>

### Install

```bash
git clone https://github.com/mhdfzan/beeceptor-playwright-automation.git
cd beeceptor-playwright-automation
npm install
npm run install:browsers            # downloads Chromium
```

### Configure (optional)

```bash
cp .env.example .env
# Edit .env — every value is optional
```

- Without credentials, the suite uses Beeceptor's anonymous free tier and
  creates a fresh endpoint each run.
- Set `BEECEPTOR_ENDPOINT=<name>` to reuse the same endpoint every run
  (bypasses free-tier creation rate limits).

### Run

```bash
npm test                 # headless, single Chromium project
npm run test:headed      # watch the browser drive the UI
npm run test:slow        # 500ms slow-mo — great for demo videos
npm run test:debug       # step through with Playwright Inspector
npm run test:all-browsers # Chromium + Firefox + WebKit
npm run demo             # runs test:slow AND copies every step's
                         #   video into ./demo/ with readable names
npm run report           # open the HTML report after a run
```

Lint & format:

```bash
npm run lint
npm run format:check
```

---

## Round-trip verification (recommended)

The default suite verifies the callout via **Beeceptor's own console UI** —
it opens the logged request and asserts the outbound-callout section is
present with a success status. That's already stronger than checking the
request was merely received.

For **bulletproof round-trip proof**, point the callout at a second
Beeceptor endpoint you own and let the suite navigate to _its_ request log
to confirm the outbound call arrived intact:

```env
# .env
BEECEPTOR_ENDPOINT=my-callout-demo         # primary endpoint (has the rule)
CALLOUT_TARGET_ENDPOINT=my-callout-target  # second endpoint (receives the callout)
```

When `CALLOUT_TARGET_ENDPOINT` is set:

- The callout rule's target URL becomes `https://<name>.free.beeceptor.com/callout-received`.
- Test **7b** activates — it opens the target endpoint's console, reloads
  the request log, and asserts a request with path `/callout-received`
  appeared. This proves the callout fired **AND** hit its target
  successfully.

If `CALLOUT_TARGET_ENDPOINT` is not set, Step 7b is transparently skipped
and `httpbin.org/post` is used as a lightweight external target.

---

## Recording the demo video

Every Playwright run auto-records each test step as its own `.webm` under
`test-results/`. To make finding + sharing them trivial:

```bash
npm run demo
```

This wraps `test:slow` and, on completion, copies each step's video into a
top-level `demo/` folder with readable names:

```
demo/
├── 01-authenticate-skipped-if-no-credentials.webm
├── 02-create-or-reuse-a-mock-endpoint.webm
├── 03-open-the-mocking-rules-panel.webm
├── 04-create-and-configure-the-http-callout-rule.webm
├── 05-trigger-the-endpoint-immediate-response-should-match-rule.webm
├── 06-verify-the-outbound-http-callout-actually-fired.webm
├── 07-non-matching-path-does-not-trigger-the-callout.webm
├── 07b-optional-round-trip-verify-via-second-beeceptor-endpoint.webm
└── 08-cleanup-remove-rule-and-optionally-endpoint.webm
```

For the assignment submission, record a 2–3 minute screen+webcam voiceover
on top of these clips (Loom / OBS / QuickTime) and attach it to the form.

---

After every run, the following land on disk (and are uploaded by CI):

| Artifact         | Path                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| HTML report      | `playwright-report/index.html`                                                   |
| Video recordings | `test-results/**/video.webm`                                                     |
| Screenshots      | `test-results/06-callout-verification.png`, `07b-roundtrip-verification.png` &c. |
| Traces           | `test-results/**/trace.zip` (on retry)                                           |
| JSON results     | `test-results/results.json`                                                      |

---

## Continuous integration

`/.github/workflows/e2e.yml` runs on every push and pull-request to `main`:

1. **Lint job** — ESLint + Prettier check.
2. **E2E job** — installs Chromium, runs the suite headless, uploads the
   HTML report + videos + traces as artifacts.

Credentials come from repo **Actions secrets**:

- `BEECEPTOR_EMAIL`
- `BEECEPTOR_PASSWORD`
- `BEECEPTOR_ENDPOINT` (recommended — reuses one endpoint across CI runs)

---

## Testing approach & rationale

### Why Playwright?

- **Same tool for browser AND API calls** — no separate HTTP client, and both
  share the same trace/report.
- **Auto-waiting locators** minimise the classic Selenium flakiness.
- **Video + trace out of the box** — perfect for both interview demos and
  CI post-mortems.

### Selector strategy

Beeceptor's DOM has a mix of stable IDs (`#matchMethod`, `#saveProxy`,
`#no-transform`, `#createNew`) and legacy class-based Bootstrap components.
The page objects prefer the stable IDs and only fall back to text/role
locators when necessary — this keeps the tests robust against CSS churn.

### Why serial mode?

Beeceptor's UI reflects a single, mutable endpoint state. Running steps in
parallel would race on rule creation/deletion and the request log. Serial
mode + a single worker keeps the flow deterministic.

### Independent callout verification

The console UI shows the _outbound_ callout details when a request row is
expanded. Step 6 clicks into the row, looks for the callout section, and
scrapes the status code from the visible text — assert-driven proof that
the feature actually fired, not just that Beeceptor received something.

### What I'd add next

- **Data-driven parametrization** — sweep methods (GET/PUT/DELETE), paths, and payload transforms in one run.
- **Visual regression** snapshots of the callout details panel.
- **Retry semantics** for the callout target being briefly down.
- **Publish the HTML report to GitHub Pages** so reviewers can browse it without downloading artifacts.

---

## Demo video

Run `npm run demo` to produce clip files under `demo/` (see [Recording the
demo video](#recording-the-demo-video) above). A 2–3 minute walkthrough with
face + voiceover is submitted separately via the assignment form and covers:

1. What the HTTP Callout feature does and why it matters.
2. A live run of the suite (headed, slow-mo).
3. Key design decisions — the callout-verification step (6), the optional
   round-trip step (7b), POM structure, and the CI pipeline.

---

## License

MIT
