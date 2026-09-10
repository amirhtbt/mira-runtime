# G04 Implementation — 2026-09-10

Gate: G04 / Issue #5  
Status: IMPLEMENTED LOCALLY / PR AND STAGING EVIDENCE PENDING

## Implemented boundary

- One `sales_documents` aggregate with explicit `proforma | invoice` types and independent numbering sequences.
- Stable business-scoped customers, document items, adjustments, immutable final snapshots, append-only payments and payment allocations.
- Integer-only authoritative money calculation; frontend totals are never trusted as stored results.
- Recoverable drafts with optimistic version checks and server-enforced lifecycle transitions.
- G03 settings are snapshotted at finalization so later seller/settings changes do not mutate issued documents.
- Deposits/installments attach to an issued pro-forma. Overpayment is rejected and balance is derived.
- Exact full settlement unlocks one idempotent linked invoice without mutating the source pro-forma.
- The linked final invoice contains the full settled sale total and intentionally omits installment/payment breakdown.
- A direct invoice requires explicit full-payment confirmation and has no invented source pro-forma.
- Conversion identity is explicit through `source_document_id`; future analytics must not infer conversion from matching content.
- Final sales and active pro-forma payment projections remain separate to prevent double counting.

## UI and API

The accepted G02/G03 shell now routes the single `سند جدید` action to a lightweight type choice and shared Persian RTL editor. It supports customer/name entry, an item and amount, draft creation/recovery, pro-forma issuance, payment progress, settlement and linked final-invoice issuance. Direct final invoices use the same editor with explicit paid confirmation.

API surface:

- `GET|POST /api/v1/documents`
- `GET|PUT /api/v1/documents/{id}`
- `POST /api/v1/documents/{id}/finalize`
- `POST /api/v1/documents/{id}/payments`
- `POST /api/v1/documents/{id}/final-invoice`

Every query is scoped with the server-derived authenticated `business_id`. Arbitrary tenant identifiers are not accepted from request bodies.

## Verification contract

The G04 database test covers deterministic calculation, draft recovery/version conflict, tenant and customer isolation, immutable finalization/snapshot boundary, the canonical 10M → 3M → 7M settlement, overpayment rejection, payment retry idempotency, single linked conversion, omission of installments from the invoice, direct paid invoices and separate financial projections.

Frontend visual/interaction coverage includes Android light/dark and desktop RTL draft creation plus the direct-invoice no-breakdown boundary. Existing G01–G03 tests remain mandatory.

Exact commit, PR, CI, merge, deploy and smoke identifiers are intentionally left for the verified GitHub/staging execution. G04 must remain open as `AWAITING OWNER ACCEPTANCE` after deployment. Real iOS remains `DEFERRED / NOT PASSED` to G08 before G09.

## Deferred

- final templates: G05
- image/PDF export and Telegram sharing: G06
- full customer history/search UI: G07
- conversion analytics dashboard: G09
- payment gateway, accounting, inventory, CRM and formal Iranian tax-invoice compliance: outside V1
