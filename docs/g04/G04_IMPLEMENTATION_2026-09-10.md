# G04 Implementation — 2026-09-10

Gate: G04 / Issue #5  
Status: IMPLEMENTED / DEPLOYED / AWAITING OWNER ACCEPTANCE

Accepted implementation merge: `6e8402e113cb12098d9351fe11e3f3bb5c9f0f35`  
Implementation PR: #49

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

## Verified delivery evidence

- Exact PR head: `713cff376a60a7ecce7d5956110815aac6a3987f`
- PR Quality CI run `34469433292`: PASS
  - frontend: PASS, including 18 unit tests, build, bundle scan and 18 Playwright interaction/visual tests
  - backend: PASS, including PHP syntax, migrations 001–003, G01/G03 regressions and G04 deterministic database tests
  - deployment-safety: PASS
  - repository secrets: PASS
- Merge SHA: `6e8402e113cb12098d9351fe11e3f3bb5c9f0f35`
- Post-merge main Quality CI run `34469579178`: PASS
- `deploy/staging` fast-forwarded to the exact merge SHA.
- Direct cPanel staging deploy run `34469726490`: PASS, including rebuild/tests, release preparation, FTPS publication and migration 003.
- Live `/api/v1/health`: HTTP 200 and gate `G04`.
- Live unauthenticated `/api/v1/documents`: HTTP 401.
- Live assets: `index-C8pmZp0_.js` and `index-CiWxBeV0.css`.
- Staging responses retain `X-Robots-Tag: noindex, nofollow, noarchive`.

G04 remains open as `AWAITING OWNER ACCEPTANCE`. Real iOS remains `DEFERRED / NOT PASSED` to G08 before G09.

## Deferred

- final templates: G05
- image/PDF export and Telegram sharing: G06
- full customer history/search UI: G07
- conversion analytics dashboard: G09
- payment gateway, accounting, inventory, CRM and formal Iranian tax-invoice compliance: outside V1
