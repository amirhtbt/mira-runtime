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
- new-invoice primary CTA
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

## G04 — Invoice Engine

Deliver:
- item editor
- quantity/price
- discount/shipping/adjustments
- deterministic total engine
- draft autosave
- live preview data model
- invoice numbering

Tests:
- full financial correctness matrix
- 1/20/100 item tests
- autosave/recovery
- concurrency/idempotency where relevant

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
- invoice list
- search/filter
- open/preview
- duplicate
- archive
- optional lightweight customer/product save

Tests:
- ownership isolation
- pagination/query performance
- duplicate preserves totals/settings correctly

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
