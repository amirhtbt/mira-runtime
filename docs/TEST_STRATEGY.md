# Test & Optimization Strategy

## 1. Test layers

### Unit tests
- money arithmetic
- rounding
- line totals
- discounts
- fixed/percent adjustments
- shipping/service adjustments
- Rial/Toman conversion/display policy
- numbering
- separate pro-forma/invoice numbering sequences
- conversion eligibility and idempotency
- payment allocation and derived balance status
- date formatting
- settings merge/defaulting
- Telegram auth validation helpers
- strict `initData` query parsing/duplicate rejection
- template view-model normalization

Money calculations must use integer minor/base units or another deterministic decimal strategy; never binary float arithmetic for financial totals.

### API integration tests
- auth/session
- CRUD sales document for both explicit types
- pro-forma-to-invoice conversion/link integrity
- append/void payment and invoice allocation
- ownership isolation / IDOR protection
- business scoping
- customer/product optional persistence
- complete per-customer document history and financial aggregation
- template metadata
- export requests
- upload validation
- migration compatibility

### Client component tests
- item editor
- quantity controls
- totals
- settings progressive disclosure
- template selector
- loading/error states
- RTL mixed-content rendering
- Telegram adapter fallbacks/capability checks

### End-to-end tests
Critical user journeys:
1. new user -> choose pro-forma/invoice -> first document -> export
2. returning user -> duplicate -> change -> export
3. settings -> card details -> invoice output
4. 20-item invoice
5. expired/invalid Telegram session
6. failed network -> retry/draft recovery
7. template switch preserves totals
8. PDF/image export output
9. pro-forma -> convert once -> linked invoice -> partial payment -> paid
10. customer -> all pro-formas/invoices -> conversion links and correct balance

### Visual regression
For every template + key viewport:
- Android narrow
- Android normal
- iPhone-class viewport
- Telegram Desktop
- light/dark app chrome where applicable

Snapshot invoice outputs for template fixtures.

## 2. Security tests

Mandatory:
- valid Telegram `initData`
- invalid hash
- tampered signed field
- tampered Telegram user JSON / user ID
- malformed percent-encoding
- duplicate `hash`
- duplicate `auth_date`
- duplicate `user`
- duplicate `query_id` when present
- expired `auth_date`
- unreasonably future `auth_date`
- replay-resistance/session-mint policy
- raw `initData` cannot act as a long-lived normal API bearer credential
- session expiry/rotation/revocation
- authorization across users/businesses
- client-supplied `business_id` cannot widen server authorization scope
- SQL injection attempts
- stored/reflected XSS in seller/customer/item/note fields
- malicious SVG/file upload behavior
- oversized upload
- decompression-bomb/resource-exhaustion image cases
- MIME spoofing
- path traversal
- CSRF/session policy where applicable
- cross-origin requests cannot invoke privileged state changes
- production/staging origin and secret isolation
- rate limiting on write/export endpoints
- secrets not present in JS bundle/repository
- security headers and HTTPS only

Telegram hash comparison must be constant-time. Tests must exercise the strict query parser instead of only testing already-parsed fixtures.

## 3. Financial correctness tests

Treat totals as correctness-critical.

Test matrix:
- qty 0/1/large
- negative values rejected where not explicitly supported
- percent boundaries
- very large totals
- combined line + invoice discounts
- rounding order
- Rial/Toman presentation
- formatted/unformatted parse behavior
- payment sum below/equal/above invoice total
- voided payment exclusion
- pro-forma exclusion from billed/paid/outstanding totals

The engine total is authoritative; templates cannot recalculate independently.

Historical snapshot tests must prove that changing settings, calculation-engine implementation or template defaults cannot alter stored authoritative totals for finalized/exported invoices.

Conversion tests must prove that the source pro-forma remains immutable, the invoice receives its own number/snapshot, repeated requests are idempotent, cross-business/customer links are rejected and analytics counts explicit eligible links rather than amount/name matches.

## 4. Performance budgets

Initial targets for a mid-range phone on typical mobile conditions; refine after field telemetry.

### Client
- initial compressed JS target <= 300 KB where practical
- avoid loading template preview assets until needed
- first useful UI target <= 2.5 s p75
- primary interaction response <= 100 ms typical
- INP target < 200 ms p75 where measurable
- invoice preview recalculation/render <= 100 ms for 20 items
- <= 250 ms for 100-item stress case

### Animation
- target 60 fps on supported mid-range devices
- no long task > 50 ms during primary data entry where practical
- downgrade expensive motion on low-performance devices
- reduced-motion mode must be fully functional

### API
- normal CRUD API target < 500 ms p95 from domestic target network, excluding external dependencies
- avoid synchronous Telegram Bot API dependency in invoice creation

### Export
- typical 20-item image export target <= 2 s
- typical 20-item PDF export target <= 3 s
- export failure must never lose invoice data

Performance targets are acceptance budgets, not reasons to weaken correctness/security tests. If production-like shared hosting cannot meet a budget, record measured evidence and an explicit exception or change architecture before acceptance.

## 5. Reliability

- autosave draft after meaningful edits with debounce
- idempotency for export/finalize operations where needed
- database backups
- migration rollback plan
- graceful handling of duplicate requests
- structured server logs with request correlation id
- no invoice content in error telemetry unless required and explicitly protected
- Telegram Bot API unavailability must not corrupt or block the authoritative invoice transaction path

## 6. Compatibility matrix

Manual acceptance on:
- Telegram Android current
- Telegram iOS current
- Telegram Desktop current
- at least one lower/mid-range Android reference device
- common screen sizes

Recorded exception for the current device inventory: iOS real-device acceptance is deferred, not passed, to G08/pre-pilot and must complete before G09. G02's iPhone-class simulated viewport is visual regression coverage only.

G01 additionally verifies:
- production/staging configured origins
- light/dark Telegram behavior
- BackButton behavior
- safe-area and content-safe-area behavior
- stable viewport behavior during resize/keyboard interactions
- haptic adapter fallback
- same-origin session/cookie behavior on Android/iOS/Desktop
- app launch from the configured Main Mini App entry point

## 7. Optimization gate

Before pilot:
- performance profile on production-like shared host
- bundle audit
- database query audit
- index review
- image/font compression
- template lazy loading
- cache headers
- PHP opcache verification when host permits
- slow-query/error logging strategy
- selected-host network acceptance from Iranian user paths and common VPN/proxy paths
