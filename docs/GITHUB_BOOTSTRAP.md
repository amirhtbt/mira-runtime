# GitHub Bootstrap Plan

Repository:
`amirhtbt/telegram-invoice-miniapp`

Visibility: Private during early development.

## Initial repository contents

- README.md
- docs/PRODUCT_SPEC.md
- docs/ARCHITECTURE.md
- docs/HOSTING_REQUIREMENTS.md
- docs/UX_DESIGN_SYSTEM.md
- docs/TEMPLATE_SYSTEM.md
- docs/TEST_STRATEGY.md
- docs/ROADMAP_AND_GATES.md
- docs/PILOT_AND_MIGRATION.md
- docs/CURRENT_EXECUTION_ORDER.md
- .github/ISSUE_TEMPLATE/gate.md

## Initial issues

1. `G00 — Product and architecture freeze`
2. `G01 — Telegram Mini App foundation and trusted authentication`
3. `G02 — Animated RTL app shell and design system`
4. `G03 — Seller profile and configurable invoice settings`
5. `G04 — Deterministic invoice engine and draft workflow`
6. `G05 — Versioned template engine and first five templates`
7. `G06 — Persian image/PDF export and Telegram sharing`
8. `G07 — Invoice history, search, duplicate and lightweight reuse`
9. `G08 — Production security, performance and deployment hardening`
10. `G09 — Free pilot, analytics and user feedback`
11. `G10 — Product-market-fit review and expansion decision`
12. `G11 — Web/paid migration foundation after positive G10`

## Gate discipline

- One active delivery gate at a time unless an explicit dependency requires parallel work.
- Each code gate uses a branch and PR.
- PR body links the gate issue and lists acceptance evidence.
- No test deletion/weakening to force green CI.
- Performance/security exceptions require owner decision recorded in GitHub.
- Production changes require a deploy artifact traceable to a commit SHA.
- Closed gates are not reopened without a documented regression/new finding.
