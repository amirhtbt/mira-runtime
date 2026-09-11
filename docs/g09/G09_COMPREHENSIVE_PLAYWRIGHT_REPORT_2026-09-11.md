# G09 Comprehensive Playwright Report — 2026-09-11

Status: **AUTOMATED REGRESSION COMPLETE — MERGE/STAGING ACCEPTANCE PENDING**  
Parent: #10  
Execution subtask: #71  
PR: #72  
Production: **untouched / unauthorized**

## Provenance

Baseline at start:

- `main`: `9ab6841eca810d617c21e4455f0ba6a3035142a7`
- `deploy/staging`: `9ab6841eca810d617c21e4455f0ba6a3035142a7`
- PR #70 was already merged and G09 was active.

Comprehensive test work was isolated on `g09/comprehensive-playwright`.

The last code/test head before this report-only commit was:

`3def1697dd9856f072a6723c3d4c22ffa5a5f1db`

Quality CI run `34643958626` passed all jobs on that head:

- frontend: **PASS**
- authenticated-e2e: **PASS**
- backend: **PASS**
- deployment-safety: **PASS**
- secrets: **PASS**

The final PR head must also be green after this documentation-only commit before merge.

## Result legend

- **PASS** — executed at the stated layer/environment and met the assertion.
- **PARTIAL PASS** — important contract executed, but some requested platform/UI variants are outside the automated layer.
- **FAIL** — executed and failed; evidence/root cause recorded.
- **BLOCKED** — cannot be truthfully executed without a safe missing facility.
- **MANUAL REQUIRED** — requires real Telegram/iOS/platform behavior that Chromium simulation cannot establish.

## Phase 0 — infrastructure and baseline

**PASS**

Implemented without weakening existing tests:

- Playwright remains pinned at `1.55.0`.
- Local `webServer` and opt-in external `PLAYWRIGHT_BASE_URL` are separated.
- E2E projects: Desktop Chrome, Android-like Chromium, iPhone-like Chromium simulation.
- Existing visual-regression project remains intact.
- CI retries: 1; test timeout: 30 s; expect timeout: 5 s.
- Screenshot: failure only; trace: first retry; video: retained on failure.
- CI reporters: line + JUnit + HTML.
- failure evidence retained for 3 days only.
- Vitest and Playwright suites are explicitly separated.
- smoke checks cover shell rendering, five-slot navigation, uncaught page/console errors and horizontal overflow.
- live health assertion checks `gate=G09` only when an external target is explicitly selected.
- staging deploy workflow now runs a post-deploy Playwright smoke against the exact staging release.

### Failure 0.1 — Vitest/Playwright runner boundary

Tested head: `32790fc968605b1e2f17421865f0d251d4cd02e9`  
Quality CI: `34642228154`

Observed: Vitest collected `tests/e2e/g09-smoke.e2e.spec.ts` and failed while importing Playwright `test.describe()`.

Expected: Vitest owns unit/component suites; Playwright owns `tests/visual/**` and `tests/e2e/**`.

Root cause: `vite.config.ts` excluded `tests/visual/**` but not `tests/e2e/**`.

Bounded fix: `fc0ad4b6df112357a13dedd1d57722637b831efb`.

### Failure 0.2 — ineffective CSP meta directive

Tested head: `fc0ad4b6df112357a13dedd1d57722637b831efb`  
Quality CI: `34642380383`

Playwright result: 22 PASS / 3 intentional live-health SKIP / 3 FAIL.

Observed on all three viewports:

`The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.`

Expected: no browser console errors.

Root cause: `index.html` put `frame-ancestors` in CSP `<meta>`, although browsers honor that directive only from an HTTP response header. Apache `.htaccess` already supplied the correct deployed `frame-ancestors` header.

Bounded fix: `8f7082ceed3e2c127a6465f6eb254cadf12ab618` removes only the ineffective meta directive; deployed header policy remains intact.

## Phase 1 — authentication and tenant isolation

**PASS at authenticated HTTP/session/API layer. Real Telegram WebView login: MANUAL REQUIRED.**

A disposable MySQL + real PHP API CI job now:

1. runs with `APP_ENV=test`;
2. signs Telegram `initData` using an obviously synthetic test token;
3. authenticates synthetic account A;
4. persists A-specific settings, customer and document;
5. logs out and verifies session becomes 401;
6. authenticates synthetic account B;
7. verifies B has a different internal user/business scope;
8. verifies B cannot see A settings/customer/document;
9. verifies cross-tenant document access returns 404 and customer mutation is safely rejected;
10. persists independent B settings;
11. logs out;
12. re-authenticates A and verifies A settings/customer/document remain intact.

No production/staging auth bypass was added. The only source-tree runtime fallback introduced for this CI path is guarded by `APP_ENV=test`; shared-host staging/production continue using the generated flat runtime.

Existing backend auth tests additionally cover replay prevention, session renewal rotation, absolute expiry, expired sessions, internal UUID identity and Telegram-session binding.

### Harness findings while establishing Phase 1

- Run `34643080558`: test job used an HTTP APP_ORIGIN; production Config correctly rejected it. The harness was changed to a synthetic HTTPS origin; the security rule was not weakened.
- Run `34643257349`: direct source checkout could not load the generated shared-host runtime. A source autoload fallback was added only for explicit `APP_ENV=test`.
- Run `34643628742`: first attempt tried to reuse an HTTP-created session in the browser, but the real App correctly required Telegram launch `initData`; retry then hit 409 because it reused the same synthetic customer fixture. The unsupported browser assertion was removed rather than adding an auth bypass, and each retry now gets a separate synthetic namespace.
- Run `34643958626`: authenticated A/B E2E **PASS**.

Real Telegram WebView launch/login remains explicitly outside this automation.

## Phase 2 — official and informal settings

**PASS at persistence/domain layer; PARTIAL PASS at browser presentation layer.**

Coverage includes:

- separated personal/informal and company/official profile storage;
- required seller phone validation;
- official identity/company data;
- payment-account persistence;
- integer tax rate/default behavior;
- tenant isolation;
- immutable finalized document settings snapshots;
- logo MIME/size protection;
- mass-assignment, HTML/bidi and oversized-input rejection;
- browser settings progressive UI and small-viewport/safe-area behavior.

A real user-selected logo file across every requested profile/platform combination is not exhaustively re-run by the new E2E suite.

## Phase 3 — customers

**PASS at server-authoritative layer; PARTIAL PASS at browser interaction layer.**

Deterministic coverage includes:

- create/list/search/update customer;
- normalized phone behavior and duplicate-mobile rejection;
- customer tenant isolation;
- cross-tenant access protection;
- customer linkage to documents;
- history search/grouping by customer.

The new authenticated A/B job verifies a real persisted customer for A is invisible to B and restored when A returns. Every autocomplete/back/reload UI permutation is not separately claimed as browser-level PASS.

## Phase 4 — document construction and calculations

**PASS for key browser + deterministic domain contracts.**

Automated coverage includes:

- integer-only money contract;
- decimal/invalid money rejection in backend domain tests;
- row quantities/prices/discounts;
- unofficial zero-tax behavior;
- official tax behavior;
- official identity required in browser regression;
- 10% VAT browser assertion: 10,000,000 Rial → 11,000,000 Rial;
- quantity zero browser rejection;
- multi-row editor;
- finalized settings snapshot;
- cross-tenant document isolation;
- direct invoice full-payment contract;
- version/conflict/idempotency guards in backend tests.

## Phase 5 — pro-forma, payments and conversion

**PASS.**

Reference journey is automated in browser and deterministic backend tests:

1. 10,000,000 Rial pro-forma;
2. issue document;
3. record 3,000,000 Rial payment;
4. verify 7,000,000 Rial remaining;
5. reject 8,000,000 Rial overpayment;
6. record 7,000,000 Rial second payment;
7. verify settlement;
8. convert once to final invoice;
9. backend verifies explicit `source_document_id`;
10. final invoice remains 10,000,000 Rial;
11. final invoice does not show installment breakdown;
12. payments remain associated with the pro-forma;
13. conversion is idempotent / no double counting;
14. backend history verifies both documents belong to the same customer history.

## Phase 6 — draft, preview and navigation

**PASS for automated browser contract; real Telegram system Back: MANUAL REQUIRED.**

Browser regression covers:

- draft persistence after reload;
- repeated preview open/close;
- preservation of customer/phone/item/discount draft values;
- preview dialog visibility and closure;
- preview fit checks from existing G04 browser suite;
- no horizontal page overflow;
- no uncaught page/console errors in smoke path.

Telegram BackButton lifecycle cannot be promoted to a real-device PASS from Chromium simulation.

## Phase 7 — templates

**PASS at browser simulation layer.**

Existing Playwright coverage remains enabled for the three real landscape structures:

- Minimal;
- Modern Commercial;
- Classic Commercial.

Coverage includes landscape-only structure, structural distinction, selection, theme colour, zoom/full preview, persistence messaging, overflow checks and absence of the duplicate default-template section in Settings.

## Phase 8 — export and sharing

**PARTIAL PASS.**

Automated evidence includes:

- real browser PDF generation/download from an issued Persian invoice;
- deterministic filename `invoice-INV-00001.pdf`;
- export rendering model tests for official VAT/account selection, integer Rial values and large multi-page item sets;
- export evidence is permitted only for issued tenant-scoped documents;
- repeated export does not alter document accounting in deterministic backend tests;
- G09 export analytics is allowlisted/privacy-safe.

A full browser matrix of PNG + PDF across all four official/informal × invoice/pro-forma combinations was not exhaustively executed in this tranche.

Web Share/iOS/Telegram share is **MANUAL REQUIRED**. A mocked browser Web Share call would only prove invocation and is deliberately not reported as real share-sheet acceptance.

## Phase 9 — history, search and document actions

**PASS at deterministic server-authoritative layer; PARTIAL PASS at browser UI layer.**

Coverage includes:

- customer-grouped history;
- search by customer and item/domain fields supported by current contract;
- tenant-scoped listing;
- duplicate/reuse to draft;
- reversible archive behavior;
- issued-document protection/allowed actions;
- cursor pagination without duplicate records;
- both source pro-forma and converted invoice in the same customer history.

Not every history filter/action permutation was re-executed through browser clicks in this tranche.

## Phase 10 — G09 analytics and feedback

**PASS at backend integration/privacy layer.**

Deterministic tests verify:

- authoritative issued/converted/export events;
- client event allowlist;
- rejection of unapproved properties;
- no customer name, phone, item, note, card/account detail or payment amount in `app_events`;
- feedback is hidden until eligibility;
- eligibility after the defined document/activity rules;
- feedback can be submitted once;
- score/category validation;
- tenant-separated feedback status;
- conversion event uses explicit source-document linkage;
- analytics failure remains best-effort and does not become the document authority.

Real multi-day pilot eligibility still depends on real pilot usage and is not replaced by CI.

## Phase 11 — responsive, accessibility and stability

**PASS for automated Chromium viewport/stability scope; real iPhone/Telegram: MANUAL REQUIRED.**

Automated projects:

- Desktop Chrome;
- Android-like Chromium;
- iPhone-like Chromium simulation.

Coverage includes:

- five-slot bottom navigation;
- Templates remains the leftmost logical navigation item in current RTL shell contract;
- safe-area/bottom-bar spacing from existing browser tests;
- keyboard navigation checks already present in G02/G03;
- horizontal overflow checks;
- no console/page errors in smoke path;
- idempotency/version/conflict/rate-limit/error guards in backend tests;
- refresh/draft recovery;
- secret scan and security guards.

### Real application bug found — hidden export renderer caused mobile horizontal scrolling

Quality CI `34642801399` / head `493b3822b35c3180a5da19fb306e0aa0f28b62c9`:

- Desktop reference payment journey passed.
- Android-like and iPhone-like failed after issuance while trying the next payment action.
- button was visible/enabled/stable, but `<html>` intercepted pointer events.
- trace evidence recorded RTL horizontal displacement (`scrollLeft=-1236` at device scale) and the failure screenshot showed blank off-canvas space while the accessibility tree still contained the payment UI.

Root cause: `.export-render-stage` was fixed at `left:-20000px` with A4 width, which expanded the scrollable area after an issued document mounted export actions on narrow RTL viewports.

Bounded fix: `356b599eddd7e0885cb99a6eade1bbc19c320683` contains the hidden renderer in a fixed 1×1 clipped box while preserving the 1123×794 child used by `html-to-image`.

Regression test: `40663c040b8a4656c1426419cfc8d56fda27bdf3` explicitly asserts no horizontal overflow/offset after issued pro-forma and converted invoice.

Subsequent frontend CI is green, including the pre-existing real PDF download test.

## Phase 12 — full regression

**PASS on code/test head `3def1697dd9856f072a6723c3d4c22ffa5a5f1db`; final report-only head CI required before merge.**

Quality CI `34643958626` passed:

- frontend typecheck;
- Vitest/frontend tests;
- production build;
- bundle secret scan;
- existing visual regression;
- new multi-viewport E2E smoke and sales regressions;
- disposable authenticated A/B tenant E2E;
- PHP syntax;
- unit security tests;
- migrations;
- backend auth/session integration;
- settings persistence/security;
- sales-domain integration;
- G09 privacy analytics/feedback integration;
- database backup/restore rehearsal;
- deployment-safety guards;
- repository secret scan.

## Failure evidence retention

Failure artifacts are privacy-safe synthetic evidence with 3-day retention.

Notable retained evidence during diagnosis:

- run `34643257349`: mobile overflow trace/screenshots used to diagnose export-stage displacement;
- run `34643628742`: authenticated-E2E failure artifact `10281180721`, used to diagnose missing real Telegram launch data and retry fixture collision.

No real customer/phone/payment/card/IBAN data was intentionally introduced into these artifacts.

## Final matrix before merge/staging deployment

| Phase | Status | Layer / boundary |
|---|---|---|
| 0 — Infra / baseline | PASS | Playwright/CI infrastructure complete; exact final docs-head CI still required |
| 1 — Auth / tenant isolation | PASS + MANUAL REQUIRED | signed synthetic Telegram HTTP/session/API E2E PASS; real Telegram WebView manual |
| 2 — Settings | PASS / PARTIAL UI | persistence/security PASS; exhaustive profile UI matrix not claimed |
| 3 — Customers | PASS / PARTIAL UI | server-authoritative tenant/customer behavior PASS |
| 4 — Documents/calculation | PASS | browser key path + backend integer/tax/validation guards |
| 5 — Pro-forma/payment/conversion | PASS | exact 10M → 3M + 7M reference journey and idempotency |
| 6 — Draft/preview/navigation | PASS + MANUAL REQUIRED | browser draft/preview PASS; real Telegram Back manual |
| 7 — Templates | PASS | three landscape structures at browser simulation layer |
| 8 — Export/share | PARTIAL PASS + MANUAL REQUIRED | real browser PDF PASS; exhaustive PNG matrix and real share sheet not claimed |
| 9 — History/search/actions | PASS / PARTIAL UI | server-authoritative semantics PASS; exhaustive UI permutations not claimed |
| 10 — G09 analytics/feedback | PASS | privacy/eligibility/tenant integration layer |
| 11 — Responsive/a11y/stability | PASS + MANUAL REQUIRED | three Chromium projects PASS; real iOS/Telegram manual |
| 12 — Full regression | PASS | code/test head run `34643958626`; final report-only head CI required |

## Bugs/failures fixed in this tranche

1. Vitest accidentally collecting Playwright E2E specs.
2. Browser console warning from ineffective `frame-ancestors` CSP meta directive while retaining the correct server header.
3. Mobile RTL horizontal-scroll/pointer-interception bug caused by the off-canvas hidden export renderer.
4. Authenticated-E2E environment bootstrap mismatch, solved only for explicit `APP_ENV=test`.
5. Authenticated-E2E retry fixture collision, solved with per-retry synthetic namespaces.

## Merge and deployment acceptance sequence

1. final PR head must pass Quality CI on the exact SHA;
2. merge PR #72 only after that exact-head green result;
3. verify Quality CI on the resulting merge SHA;
4. fast-forward `deploy/staging` only to that merge SHA;
5. Direct cPanel Staging Deploy must pass on that SHA;
6. its post-deploy Playwright smoke must verify shell/no-overflow/no-console-error and `/api/v1/health` `gate=G09` against `STAGING_ORIGIN`;
7. Production remains untouched;
8. #10 remains open because G09 still requires real pilot observations before G10 go/no-go.

## Owner manual acceptance after staging deploy

Keep this deliberately short; automation already covers the repeatable regression surface.

1. Open the Mini App from the real Telegram bot on one Android device and one real iPhone if available; confirm initial login, Home and five-button navigation.
2. On the real iPhone/Telegram WebView, create one synthetic test pro-forma, open/close Preview twice, use Telegram Back once, and confirm the draft remains.
3. Issue the synthetic pro-forma, register two synthetic payments, convert it once, and confirm there is no sideways blank scrolling.
4. Download one PNG and one PDF from the real Telegram WebView and visually confirm Persian/RTL/logo/landscape output.
5. Tap Share once and confirm the real OS/Telegram share sheet opens and receives the expected file. This is the key platform behavior CI cannot truthfully certify.

Do not enter real customer/payment/card/IBAN data for this acceptance.