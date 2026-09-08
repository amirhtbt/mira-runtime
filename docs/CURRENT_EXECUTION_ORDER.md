# Current Execution Order

Status date: 2026-09-08
Repository: `amirhtbt/telegram-invoice-miniapp`
Default branch: `main`

## Current gate

**G00 — Product and architecture freeze**
GitHub Issue: #1
State: OPEN / awaiting explicit Source-of-Truth review and PASS decision.

No implementation gate should start until G00 is accepted.

## Ordered gates

1. #1 — G00: Product and architecture freeze
2. #2 — G01: Telegram Mini App foundation and trusted authentication
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
- Finalized/exported invoices retain immutable snapshots including template version.
- V1 does not claim formal Iranian tax-invoice compliance and is not an accounting/inventory/CRM system.
- Shared-hosting compatibility remains a V1 architecture constraint unless G00 explicitly changes it.

## Immediate next action

Review Issue #1 and all Source-of-Truth docs for internal consistency and current Telegram/shared-hosting feasibility. Record any required G00 corrections in GitHub. If there is no blocking issue and owner scope is accepted, record G00 PASS/close #1 and begin G01 via a dedicated branch/PR. Do not implement later gates early.
