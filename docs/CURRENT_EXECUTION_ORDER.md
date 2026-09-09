# Current Execution Order

Status date: 2026-09-09
Repository: `amirhtbt/mira-runtime`
Default branch: `main`

## Current gate

**G02 — Animated RTL app shell and design system**
GitHub Issue: #3
State: ACTIVE — G01 is accepted; production-quality Persian shell implementation and acceptance are in progress.

G00 / Issue #1 is accepted and must not be reopened unless a regression, new platform constraint or explicit owner decision is documented.

## G00 acceptance evidence

- Architecture review: `docs/g00/G00_ARCHITECTURE_REVIEW_2026-09-08.md`
- Reviewed source main: `61f6f72f3b220153f77563180072152e9f2ddcba`
- Official Telegram Mini App documentation rechecked on 2026-09-08.
- Required corrections frozen before implementation: strict `initData` validation/session exchange, replay/freshness policy, 2026 origin hardening, staging/production isolation, Bot API independence, stronger immutable snapshot metadata, raster-first V1 upload policy and shared-host-compatible export boundary.
- No unresolved critical/high G00 architecture blocker remains after those corrections.

## G01 current evidence

- Foundation/auth implementation merged via PR #14.
- Session absolute-lifetime/rotation security regression fixed before merge and covered by integration tests.
- Deployment target corrected to Shataban Host Germany shared hosting; same account currently serves Box4U.
- cPanel/hosting evidence confirms Apache 2.4.68, MariaDB 10.6.28, 2 GB account RAM, 30 entry processes, 100 processes and approximately 2.14 GB free disk at evidence time.
- PHP 8.2 is available with `memory_limit=1024M`, `max_execution_time=300`, `post_max_size=512M`, `upload_max_filesize=512M` and required G01 extensions.
- Existing Box4U PHP/domain settings are explicitly out of scope and must not be changed by G01.
- Routine GitHub artifact retention is removed from staging deployment. Direct GitHub Actions → isolated cPanel FTPS deployment is the active plan, with ephemeral same-run file backup, HTTPS health check and automatic file rollback on failure.
- Provisioning, HTTPS, database/config readiness, authentication/session exchange, locally bundled Telegram bootstrap and exact-SHA staging deployment are operational.
- Telegram Desktop and Android human acceptance are PASS, including light/dark, viewport/safe-area behavior, relaunch/session and Windows proxy-only bootstrap.
- PR #39 merged as `33874d5e16f3f16f350057fe37fd2a87a36f71d9`; Telegram preserved the U+200E boundaries around the unchanged Persian menu label `ساخت فاکتور`.
- iOS real-device acceptance is explicitly DEFERRED, NOT PASSED, to G08/pre-pilot because no device is available. It does not block G02 under the recorded owner decision.
- Issue #2 is PASS / CLOSED. No unresolved critical/high security finding is recorded.

## Ordered gates

1. #1 — G00: Product and architecture freeze — PASS / CLOSED
2. #2 — G01: Telegram Mini App foundation and trusted authentication — PASS / CLOSED (iOS deferred to G08)
3. #3 — G02: Animated RTL app shell and design system — ACTIVE
4. #4 — G03: Seller profile and configurable invoice settings
5. #5 — G04: Deterministic invoice engine and draft workflow
6. #6 — G05: Versioned template engine and first five templates
7. #7 — G06: Persian image/PDF export and Telegram sharing
8. #8 — G07: Invoice history, search, duplicate and lightweight reuse
9. #9 — G08: Production security, performance and deployment hardening
10. #10 — G09: Free pilot, analytics and user feedback
11. #11 — G10: Product-market-fit review and expansion decision
12. #12 — G11: Web/paid migration foundation after positive G10

## Source of Truth priority

Before work, read in this order:
1. `docs/CURRENT_EXECUTION_ORDER.md`
2. current gate Issue
3. `README.md`
4. `docs/PRODUCT_SPEC.md`
5. `docs/ARCHITECTURE.md`
6. `docs/HOSTING_REQUIREMENTS.md`
7. `docs/UX_DESIGN_SYSTEM.md`
8. `docs/TEMPLATE_SYSTEM.md`
9. `docs/TEST_STRATEGY.md`
10. `docs/ROADMAP_AND_GATES.md`
11. `docs/PILOT_AND_MIGRATION.md`

## Gate discipline

- Work on one active delivery gate at a time unless an explicit dependency is documented.
- Do not redesign accepted earlier gates without a regression or explicit owner decision.
- Every implementation gate uses a branch + PR and links its Issue.
- Never delete, skip or weaken a security/correctness/performance test merely to make CI green.
- A gate does not PASS until its automated tests, required manual acceptance and documentation evidence are complete.
- Critical/high security findings block acceptance unless an explicit owner waiver is recorded.
- Performance exceptions require an explicit recorded decision.
- Deployments must be traceable to an exact commit SHA and recorded deployment evidence. A retained artifact is optional, not mandatory, when the workflow rebuilds/tests and deploys that exact SHA directly.
- Closed/superseded work must not be silently reopened.

## V1 invariants

- Telegram Mini App is the only product surface in V1; no public website/standalone web product.
- V1 is free during product validation; no paid wall in the pilot.
- Persian-first, RTL-first, mobile-first.
- Visual experience is animated/premium but normal invoice creation stays simple.
- Pro-forma and invoice are explicit types of one shared sales-document aggregate; the UI exposes one `سند جدید` action and one lightweight type choice.
- Conversion creates a linked invoice without mutating the pro-forma; payments affect invoices only; customer history groups both types by stable customer ID.
- Conversion analytics is derived from explicit links/events using an eligible issued-pro-forma cohort, never inferred from matching content.
- Advanced invoice parameters live in Settings/progressive disclosure.
- Templates are created/versioned by the product team through Git/CI; no end-user template builder in V1.
- Invoice calculations are authoritative domain logic, never template logic.
- Telegram ID is not the primary domain key; internal identity must survive future web/paid migration.
- Finalized/exported invoices retain immutable snapshots including template version and authoritative precomputed totals/version metadata.
- V1 does not claim formal Iranian tax-invoice compliance and is not an accounting/inventory/CRM system.
- Shared-hosting compatibility remains a V1 architecture constraint unless a later documented decision changes it.
- Raw Telegram `initData` is a short-lived bootstrap authentication input, not the application's long-lived API credential.
- Invoice creation never depends on synchronous Telegram Bot API availability.

## Immediate next action

Complete G02 only: align the shell with the dual-document vocabulary, fix the observed fixed-navigation overlap, deploy the exact accepted SHA to staging, then obtain the scoped Android visual acceptance. The G03/G04/G07/G09 implementation responsibilities are defined in `docs/SALES_DOCUMENT_DOMAIN.md`; do not pull their backend scope into G02. Real iOS testing remains mandatory in G08 before G09; simulated iPhone viewport coverage is not iOS acceptance.
