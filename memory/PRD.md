# PRD — Beeceptor Playwright Automation (Refined)

## Original problem statement

User is applying to an internship. Assignment: write a Playwright (JS)
end-to-end automation that opens Beeceptor, creates/reuses an endpoint,
authors and configures an HTTP Callout rule, triggers it, verifies the
callout executes, and cleans up. User arrived with a semi-working repo
(<https://github.com/mhdfzan/beeceptor-playwright-automation>) and asked
for refinement.

## Architecture

- **Playwright (JS)** — browser + API driven from one framework.
- **Page Object Model** — `LoginPage`, `DashboardPage`, `EndpointPage`, `MockRulePage`.
- **Custom fixtures** — auto-inject page objects into every test.
- **Config module** — one place for URLs, timeouts, rule defaults, env-var mapping.
- **Sequential describe** + `workers: 1` — Beeceptor UI state is shared.
- **GitHub Actions** — lint + e2e on push/PR with Playwright artifacts.
- **ESLint + Prettier** — code-quality gate.

## User persona

Interviewer / hiring manager reviewing this repo as a signal of
engineering thinking, code quality, and testing depth.

## Core requirements (static)

1. Create / reuse a Beeceptor endpoint.
2. Author an HTTP Callout rule via UI.
3. Trigger the endpoint over the network.
4. Verify the mock returned the expected immediate response.
5. **Verify the outbound HTTP Callout actually fired** — this is the
   defining feature of the rule.
6. Non-matching path must NOT trigger.
7. Clean up test data.
8. CI-runnable, video-recorded, video-demo-ready.

## What's been implemented (Jan 2026)

- ✅ 8-step serial test suite (was one monolithic test)
- ✅ **Real outbound-callout verification** by clicking the logged request
   and asserting the callout section + status code
- ✅ Tightened selectors — favours stable IDs (`#matchMethod`, `#saveProxy`,
   `#no-transform`, `#createNew`, `#targetUrl`) over fragile text/CSS
- ✅ `.github/workflows/e2e.yml` — lint job + Playwright job, uploads
   HTML report + videos + traces as artifacts
- ✅ ESLint (`eslint-plugin-playwright`) + Prettier configs
- ✅ Multi-browser support (`PW_ALL_BROWSERS=1` enables Firefox + WebKit)
- ✅ Rewritten README (badges, layout diagram, design decisions,
   approach section, demo-video placeholder)
- ✅ Enriched `.env.example` with `CALLOUT_TARGET_URL`, `SLOW_MO`, `PW_ALL_BROWSERS`
- ✅ New npm scripts: `lint`, `lint:fix`, `format`, `format:check`,
   `test:all-browsers`, `install:all-browsers`

## Prioritized backlog

**P1**
- Add a second Beeceptor endpoint as the callout target and query its
  request log for full round-trip proof (currently we assert via the
  primary console UI only).

**P2**
- Data-driven parametrization: methods (GET/PUT/DELETE), paths, payload
  transforms.
- Visual regression snapshots of the callout details panel.

**P3**
- Retry semantics if the callout target is briefly down.
- Publish an HTML report to GitHub Pages via a `deploy-report.yml` workflow.

## Verification

- ESLint: 0 errors, 0 warnings.
- Prettier: all files formatted.
- `npx playwright test --list` → 8 tests discovered.
- Live e2e must be run locally by the user (requires Beeceptor account
  and public internet access; not runnable in this sandbox).

## Next action items

- User: run `npm test` locally with a `.env` that has a valid
  `BEECEPTOR_ENDPOINT` for a first successful headed run.
- User: record the 2–3 minute demo video (headed / slow-mo config already
  wired: `npm run test:slow`).
- User: push to GitHub — GitHub Actions will validate lint + e2e on the PR.
