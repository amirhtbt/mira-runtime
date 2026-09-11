# G09 Comprehensive Playwright Report — 2026-09-11

Status: **IN PROGRESS**  
Parent: #10  
Execution subtask: #71  
PR: #72  
Production: **untouched / unauthorized**

## Provenance

Baseline `main` and `deploy/staging` at start:

`9ab6841eca810d617c21e4455f0ba6a3035142a7`

G09 was already merged/deployed before this test tranche. The comprehensive test work is isolated on `g09/comprehensive-playwright`.

## Result legend

- **PASS** — executed at the stated layer/environment and met the assertion.
- **FAIL** — executed and failed; evidence/root cause recorded.
- **BLOCKED** — cannot be truthfully executed at that layer without a missing safe facility or environment capability.
- **MANUAL REQUIRED** — requires real Telegram/iOS/platform behavior that simulation cannot establish.

## Phase 0 — infrastructure and baseline

### Implemented

- Playwright remains pinned at `1.55.0`.
- Local `webServer` and opt-in `PLAYWRIGHT_BASE_URL` external target are separated.
- E2E projects: Desktop Chrome, Android-like Chromium, iPhone-like Chromium simulation.
- Existing visual-regression project remains intact.
- Bounded CI retry: 1; timeout: 30 s; expect timeout: 5 s.
- Screenshot: failure only; trace: first retry; video: retained on failure.
- CI reporters: line + JUnit + HTML.
- New smoke checks: shell, five-slot nav, page errors, console errors, horizontal overflow, opt-in live G09 health assertion.
- Vitest explicitly excludes Playwright E2E files; Playwright tests are not weakened or skipped to make unit CI green.

### Failure evidence 1 — runner boundary

Tested head: `32790fc968605b1e2f17421865f0d251d4cd02e9`  
Quality CI: `34642228154`

**FAIL — test-runner configuration**

Vitest collected `tests/e2e/g09-smoke.e2e.spec.ts` and failed on Playwright `test.describe()` before Playwright execution. Existing unit/component suite reported 33 PASS before the foreign suite failure.

Root cause: `vite.config.ts` excluded `tests/visual/**` but not `tests/e2e/**`.

Fix: `fc0ad4b6df112357a13dedd1d57722637b831efb` — add `tests/e2e/**` to Vitest exclusions.

### Failure evidence 2 — ineffective CSP meta directive

Tested head: `fc0ad4b6df112357a13dedd1d57722637b831efb`  
Quality CI: `34642380383`

Backend / secret / deployment-safety layers: **PASS**.  
Frontend unit/typecheck/build/bundle-secret scan: **PASS**.  
Playwright: **22 PASS / 3 SKIP / 3 FAIL**.

The same smoke assertion failed on Desktop Chrome, Android-like and iPhone-like simulation because Chromium emitted:

`The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.`

Expected: no browser console errors.  
Actual: one CSP console error on every viewport.  
Classification: application/security markup finding, viewport-independent.

Root cause: `index.html` included `frame-ancestors` inside CSP `<meta>`. The deployed Apache `.htaccess` already sends `frame-ancestors` correctly as an HTTP response header.

Fix: `8f7082ceed3e2c127a6465f6eb254cadf12ab618` — remove only the ineffective meta directive; keep the server response-header policy intact.

### Live staging health

The historical G09 staging acceptance on #10 records HTTP 200, `gate=G09`, `X-Request-Id`, staging noindex header, and unauthenticated pilot status HTTP 401 for deployed baseline `9ab6841...`.

For this new tranche, live-health Playwright is intentionally **SKIPPED unless `PLAYWRIGHT_BASE_URL` is explicitly set**. Historical smoke is not relabeled as exact-head evidence. A fresh live smoke is required after the exact merged SHA is deployed to staging.

## Phase 1 — auth / tenant isolation

### Existing deterministic backend evidence

**PASS (backend integration layer)**

The existing test harness signs synthetic Telegram `initData` using the test-only token supplied under `APP_ENV=test`. It verifies:

- authentication creates internal UUID user/business IDs rather than using raw Telegram IDs;
- replayed launch data cannot mint a second session;
- session renewal rotates the token and revokes the previous token;
- absolute session lifetime is not extended by renewal;
- expired sessions are rejected;
- two synthetic Telegram identities receive different internal tenant scopes;
- a session is accepted only for its bound Telegram identity.

This is not yet equivalent to a full browser UI login/logout A→B→A journey.

### Browser/staging status

**BLOCKED pending safe disposable authenticated E2E target** for full A/B UI persistence and cross-tenant API probes. No staging/production auth bypass will be introduced. The preferred route is the existing signed synthetic-initData contract against `APP_ENV=test` with a disposable database, not real Telegram identities.

## Existing browser coverage mapped forward

The pre-existing Playwright visual/browser suite already exercises browser-level parts of later phases and remains enabled:

- G03 settings progressive UI and bottom-safe-area behavior;
- G04 RTL sales flow, 10,000,000 Rial pro-forma, 3,000,000 payment, 7,000,000 remaining balance;
- final invoice full-settlement presentation without installment breakdown;
- official identity field appears conditionally;
- multi-row editor and preview modal fit;
- actual PDF browser download with deterministic invoice filename;
- G05 three landscape-only structures: Minimal, Modern Commercial, Classic Commercial;
- template selection, colour, zoom/full preview, persistence messaging, and no duplicate default-template section in Settings;
- keyboard navigation, five-slot bottom nav, safe-area and horizontal-overflow checks.

These assertions are browser-level preview-harness coverage; server-authoritative persistence/tenant behavior is reported separately.

## Manual-required boundary

The following must never be reported as automated PASS from Chromium simulation:

- real Telegram WebView lifecycle/navigation;
- real iOS Safari/Telegram safe-area and keyboard behavior;
- real iOS share sheet;
- real Telegram share destination/result.

## Current matrix

| Phase | Current status | Layer / note |
|---|---|---|
| 0 — Infra / baseline | IN PROGRESS | CI rerun pending after CSP fix |
| 1 — Auth / tenant isolation | PASS + BLOCKED | backend isolation PASS; full browser A/B journey needs disposable authenticated E2E target |
| 2 — Settings | PARTIAL PASS | existing browser + backend tests; comprehensive scenario expansion pending |
| 3 — Customers | PENDING | comprehensive Playwright expansion pending |
| 4 — Documents/calculation | PARTIAL PASS | browser preview + backend deterministic tests |
| 5 — Pro-forma/payment/conversion | PARTIAL PASS | browser payment path + backend domain tests |
| 6 — Draft/preview/navigation | PARTIAL PASS | preview modal/browser coverage exists; expanded regression pending |
| 7 — Templates | PARTIAL PASS | browser coverage exists |
| 8 — Export/share | PARTIAL PASS | real PDF browser download covered; real platform share remains MANUAL REQUIRED |
| 9 — History/search/actions | PARTIAL PASS | unit/backend coverage exists; browser expansion pending |
| 10 — G09 analytics/feedback | PASS at backend layer | privacy/eligibility integration suite PASS; browser expansion pending |
| 11 — Responsive/a11y/stability | PARTIAL PASS | three new viewport projects + existing safe-area/keyboard checks |
| 12 — Full regression | IN PROGRESS | backend layer currently green; exact final head pending |

## Open acceptance items

- finish exact-head CI after latest bounded fix;
- expand comprehensive browser scenarios where the preview harness can truthfully exercise UI behavior;
- establish disposable authenticated E2E execution for A/B browser journeys without a staging/production bypass;
- run final exact-head regression;
- merge only if exact PR head is green;
- deploy only the merged SHA to staging;
- run fresh live staging smoke;
- keep #10 open for real pilot evidence and G10 go/no-go.
