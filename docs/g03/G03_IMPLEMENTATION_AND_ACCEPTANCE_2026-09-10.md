# G03 Implementation and Acceptance — 2026-09-10

Gate: G03 / Issue #4  
Status: PASS / CLOSED  
Accepted merge: `238cb3c9694473ce38b89b3072d21b511defb1d0`  
Implementation PR: #47

## Accepted scope

- versioned `business_settings` persistence through migration `002_g03_business_settings.sql`;
- session-derived business authorization and tenant isolation;
- seller/business profile and payment identity/instructions;
- separate pro-forma/invoice label, numbering, date and validity defaults;
- Toman/Rial, digit, calendar and monetary presentation defaults;
- item-column, financial configuration, text and visual defaults;
- bounded per-document override contract that excludes seller/payment identity;
- immutable finalized-settings snapshot boundary for later document persistence;
- content-validated PNG/JPEG/WebP logo storage scoped to the current business, with SVG rejected;
- progressive-disclosure Persian RTL Settings UI preserving the accepted G02 navigation, themes and safe-area behavior.

G03 stores financial defaults and payment instructions only. It does not implement payment transactions, deposits, settlement, final-invoice issuance, customer history, analytics, final templates or export.

## Automated evidence

- Branch/PR exact-head: `d4d1df2743a84872defab6312e5892f8b02e2b70`
- Pull request Quality CI: run `34453548104` — PASS
  - frontend — PASS, including TypeScript, 18 Vitest tests, build, client secret scan and 14 Playwright visual/interaction tests;
  - backend — PASS, including PHP syntax, G01 unit security tests, migrations 001/002, DB-backed auth/session tests and G03 settings persistence/security tests;
  - deployment-safety — PASS;
  - repository secrets — PASS.
- Main Quality CI: run `34453727298` on accepted merge `238cb3c9694473ce38b89b3072d21b511defb1d0` — PASS.
- Direct cPanel staging deploy: run `34453863464` on the same accepted SHA — PASS.
  - frontend and backend regression suites passed again;
  - migration 002 ran through the versioned migration path;
  - isolated direct FTPS deployment and live health checks passed;
  - no retained GitHub deployment artifact was required.

The final pre-PR repair changed the visual locator from a substring heading match to an exact `تنظیمات` match because `تنظیمات بیشتر` made Playwright strict selection ambiguous. No assertion or security/regression coverage was removed or weakened.

## Live staging smoke

- `/api/v1/health` returned HTTP 200 with service `telegram-invoice-api` and gate `G03`;
- unauthenticated `/api/v1/settings` returned HTTP 401 rather than exposing settings;
- the deployed page served the accepted G03 JS/CSS asset hashes;
- staging returned `X-Robots-Tag: noindex, nofollow, noarchive`;
- no unexpected public 500 or secret exposure was observed.

Authenticated save/reload and logo behavior cannot be safely synthesized outside a real Telegram session and are covered by automated integration tests plus the human acceptance below.

## Human acceptance

Owner acceptance on 2026-09-10:

- settings were saved through Telegram Desktop;
- the same saved settings were checked in Telegram Android and were correct.

This proves server persistence across separate Telegram clients/devices and completes the required real-client acceptance for G03. G02 navigation remained accepted; no regression was reported.

## Deferrals and next gate

- Real iOS acceptance remains explicitly DEFERRED / NOT PASSED to G08 before G09.
- G04 / Issue #5 is now the single active gate.
- G04 must preserve the approved domain rule: deposits/installments attach to the pro-forma; exact full settlement unlocks one idempotent linked final invoice; installment details remain in the source history and are omitted from the final invoice.

