# Current Execution Order

Status date: 2026-09-08
Repository: `amirhtbt/telegram-invoice-miniapp`
Default branch: `main`

## Current gate

**G01 — Telegram Mini App foundation and trusted authentication**
GitHub Issue: #2
State: ACTIVE after G00 architecture review PASS.

G00 / Issue #1 is accepted and must not be reopened unless a regression, new platform constraint or explicit owner decision is documented.

## G00 acceptance evidence

- Architecture review: `docs/g00/G00_ARCHITECTURE_REVIEW_2026-09-08.md`
- Reviewed source main: `61f6f72f3b220153f77563180072152e9f2ddcba`
- Official Telegram Mini App documentation rechecked on 2026-09-08.
- Required corrections frozen before implementation: strict `initData` validation/session exchange, replay/freshness policy, 2026 origin hardening, staging/production isolation, Iran-host Bot API independence, stronger immutable snapshot metadata, raster-first V1 upload policy and shared-host-compatible export boundary.
- No unresolved critical/high G00 architecture blocker remains after those corrections.

## Ordered gates

1. #1 — G00: Product and architecture freeze — PASS / CLOSED
2. #2 — G01: Telegram Mini App foundation and trusted authentication — ACTIVE
3. #3 — G02: Animated RTL app shell and design system
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
- Production changes must be traceable to a commit SHA/deploy artifact.
- Closed/superseded work must not be silently reopened.

## V1 invariants

- Telegram Mini App is the only product surface in V1; no public website/standalone web product.
- V1 is free during product validation; no paid wall in the pilot.
- Persian-first, RTL-first, mobile-first.
- Visual experience is animated/premium but normal invoice creation stays simple.
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

Execute Issue #2 / G01 on a dedicated branch and PR. Implement only the Telegram Mini App foundation/trusted authentication deliverables and tests defined by Issue #2 and the G00 Source of Truth. Do not implement G02+ early.
