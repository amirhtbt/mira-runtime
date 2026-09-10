# Roadmap & Acceptance Gates

## G00 — Product / Architecture Freeze

Deliver:
- source-of-truth docs
- V1 scope and non-goals
- stack decision
- hosting requirement sheet
- data model v1
- testing policy
- migration principles

Acceptance:
- owner accepts scope
- no unresolved architecture blocker for shared Iran host

## G01 — Telegram Foundation

Deliver:
- BotFather/Main Mini App configuration checklist
- production/staging domains
- Mini App bootstrap
- server-side initData verification
- secure session
- Telegram adapter
- safe-area/theme/back-button integration

Tests:
- valid/invalid/tampered/expired auth
- Android/iOS/Desktop launch
- dark/light Telegram theme

## G02 — Animated App Shell & Design System

Deliver:
- design tokens
- RTL typography
- bottom navigation
- one `new document` primary CTA with a simple pro-forma/invoice choice
- loading/empty/error states
- motion/haptic system
- reduced-motion fallback

Tests:
- visual regression
- 60fps-oriented transition profiling
- accessibility basics
- safe-area/keyboards/viewport

## G03 — Seller Profile & Configurable Settings

Deliver:
- business profile
- payment details
- invoice identity settings
- separate pro-forma/invoice labels and numbering defaults
- monetary settings
- item-column visibility
- notes/terms/footer
- default visual settings

Tests:
- defaults
- persistence
- malicious input/XSS
- mixed RTL/LTR
- missing optional fields

## G04 — Sales Document Engine

Deliver:
- item editor
- quantity/price
- discount/shipping/adjustments
- deterministic total engine
- draft autosave
- live preview data model
- invoice numbering
- explicit pro-forma/invoice type with separate sequences
- pro-forma deposits/installments and derived unpaid/partial/paid/overpaid progress
- one-way idempotent final-invoice issuance only after exact full settlement
- direct final-invoice path with explicit full-payment confirmation and no invented installments

Tests:
- full financial correctness matrix
- 1/20/100 item tests
- autosave/recovery
- concurrency/idempotency where relevant
- settlement-gated conversion snapshot/link integrity and pro-forma payment-allocation correctness
- final invoice omits installment breakdown while preserving the source audit history
- converted sales are not double-counted

## G05 — Template Engine + First 5 Templates

Deliver:
- normalized InvoiceViewModel
- template registry
- capabilities
- versioning
- 5 production-quality templates
- live template preview

Tests:
- template fixtures
- snapshot visual regression
- overflow/multipage
- RTL clipping
- template version stability

## G06 — Export & Telegram Sharing

Deliver:
- high quality image export
- PDF export with Persian/RTL correctness
- Telegram-oriented share flow
- export records

Tests:
- visual parity
- corrupted export handling
- large invoice export
- performance budgets
- no data loss on failure

## G07 — History / Reuse

Deliver:
- combined pro-forma/invoice list with type/status filters
- search/filter
- open/preview
- duplicate
- archive
- optional lightweight customer/product save
- per-customer document timeline, conversion links, pro-forma payment progress and final-invoice summary

Tests:
- ownership isolation
- pagination/query performance
- duplicate preserves totals/settings correctly
- customer history isolation and correct financial aggregation

## G08 — Production Hardening

Deliver:
- security pass
- performance optimization
- DB indexes
- logging/error handling
- backups
- production deployment procedure
- rollback procedure

Acceptance requires all critical/high severity test findings closed or explicitly owner-waived.

## G09 — Free Pilot

Deliver:
- controlled public/free launch
- privacy-safe product analytics
- in-app feedback prompt
- issue triage workflow

Track at minimum:
- activation
- time to first invoice
- export/share completion
- D1/D7/D30 retention
- invoices per active user
- cohort-based pro-forma-to-invoice conversion rate from explicit links/events
- error rate
- template usage
- feedback score

No paid wall in this gate.

## G10 — Product-Market-Fit Review

Decision gate based on pilot evidence.

Possible outcomes:
A. Continue Telegram-only optimization.
B. Build web + standalone account system + paid tier.
C. Narrow target segment/use case.
D. Stop/pivot.

## G11 — Migration Foundation (only after positive G10)

Potential future work:
- email/phone identities linked to internal user UUID
- standalone web client
- public website
- plan/entitlement service
- team/business memberships
- historical invoice continuity
- Telegram account linking
- optional online payment/live invoice pages

No forced migration that discards Telegram history.
