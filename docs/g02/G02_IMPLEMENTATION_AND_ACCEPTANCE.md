# G02 Implementation & Acceptance

Gate: G02 / Issue #3  
Status: PASS / CLOSED  
Accepted date: 2026-09-10  
Accepted main SHA: `ee9775533d76589428fc689f0060712509175e03`

## Product surface

- RTL-first, Persian-first, mobile-first shell with Telegram light/dark tokens.
- Locally bundled variable Vazirmatn font; no runtime font/CDN dependency.
- One `سند جدید` intent followed by a lightweight two-choice `پیش‌فاکتور` / `فاکتور فروش` surface.
- Direct final-invoice wording is limited to an already fully paid sale; no payment engine is implemented in G02.
- Final owner-approved bottom navigation uses four equal RTL slots: `خانه | سند جدید | فاکتورها | تنظیمات`.
- All four bottom-navigation controls share the same control height and vertical baseline; the blue `+` remains visually distinct but is contained inside its own slot rather than floating over another item.
- Bottom content clearance protects the last card from the fixed navigation and Telegram safe-area inset.
- New-user empty Home with immediate CTA and no invented records.
- Returning-user `HomeData` boundary for recent invoices and business/settings status; test fixtures do not enter production state.
- Designed loading, authentication error, offline and retry states.
- Telegram viewport/content-safe-area CSS synchronization, BackButton cleanup and haptic feedback.
- Desktop frame and keyboard focus fallback.

## RTL, accessibility and motion

- Structural `dir=rtl` from the document root.
- Mixed IDs use explicit LTR `bdi`; dates and amounts use isolation to prevent visual reordering.
- Navigation and actions meet the 44 px target; semantic headings, nav label, `aria-current`, alert/status roles and visible keyboard focus are covered.
- Motion is limited to short state/feedback transitions. `prefers-reduced-motion`, low-core/low-memory devices and slow-update media receive static fallbacks.
- Functional icons are local inline SVG; no icon or animation runtime dependency.

## Automated evidence

- TypeScript typecheck, Vitest component/unit tests, production build and client/repository secret scans remain enabled.
- Existing G01 PHP auth/session unit and DB-backed integration coverage remains unchanged.
- Playwright visual baselines cover Android narrow, Android normal, iPhone-class simulated and Desktop in light/dark.
- Visual tests assert no horizontal overflow, keyboard focus, safe-area behavior, navigation order/equal slot width, equal navigation control top/height, label alignment, compact bottom-bar height, minimum tap targets and final-card clearance.
- Android acceptance regressions found by the owner were fixed in code and protected by regression tests; no visual/security/correctness assertion was skipped or weakened to obtain PASS.
- The iPhone-class viewport is simulated coverage and is not real iOS acceptance.

## Final correction and deployment evidence

- PR #41 aligned the shell with the shared pro-forma/invoice sales-document vocabulary.
- PR #42 recorded the owner rule that direct final invoicing is only for an already fully paid sale; payment execution remained assigned to later gates.
- PRs #43 and #44 addressed Android-observed bottom-navigation placement regressions.
- PR #45 implemented the final owner-approved compact four-slot bottom navigation and merged on `main` as `ee9775533d76589428fc689f0060712509175e03`.
- Post-merge Quality CI run `34448474066` PASS on the exact accepted SHA, including frontend visual regression, backend/security, deployment-safety and repository secret scan.
- `deploy/staging` was fast-forwarded to the exact accepted SHA.
- Direct cPanel staging deploy run `34448613896` PASS on the exact accepted SHA, including frontend rebuild/tests, backend/security tests, DB-backed integration, release preparation without retained artifact, direct FTPS publication, environment sync/migration and live staging smoke checks.
- Staging remains isolated and `noindex`.

## Human acceptance

- Telegram Android: PASS on 2026-09-10.
- Owner explicitly confirmed the final appearance after PR #45 deployment.
- Light/dark behavior and the document-type choice were observed during the G02 Android acceptance sequence.
- The final bottom navigation appearance and alignment were accepted after the owner-requested graphical mockup was implemented.
- Desktop acceptance from G01 remains carried forward where applicable.
- Real iOS remains explicitly DEFERRED, NOT PASSED, to G08/pre-pilot before G09; it is not retroactively marked PASS here.

## Gate result

G02 is PASS / CLOSED. The next active gate is G03 / Issue #4 — Seller profile and configurable invoice settings. Payment allocation/conversion remains G04 scope, customer history remains G07 scope, and conversion analytics remains G09 scope.
