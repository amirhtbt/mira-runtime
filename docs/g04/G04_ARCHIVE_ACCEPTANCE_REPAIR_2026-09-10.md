# G04 Archive Acceptance Repair — 2026-09-10

Status: PASS / CLOSED

## Owner finding

The owner issued two pro-formas but the application still showed an empty `فاکتورها` screen. The backend records existed; the accepted shell was still rendering its G02 placeholder and never called the G04 document-list API. This blocked the real workflow because an issued pro-forma could not be reopened to record a deposit/full settlement or issue its linked final invoice.

## Required product flow

Mira supports two normal entry paths:

1. A sale already paid outside Mira can be recorded directly as a paid final invoice and shared with the customer.
2. A quote requested by phone/messenger is issued as a pro-forma and shared. Deposits or full payment are recorded against that pro-forma. Exact settlement then unlocks conversion to one linked final invoice, while payment details remain on the source pro-forma.

## Repair

- Replace the archive placeholder with the authenticated business-scoped document list.
- Show drafts, issued pro-formas and final invoices together with explicit type, customer, number, amount and settlement state.
- Show remaining balance for partially paid pro-formas.
- Reopen any archive record into its correct detail/action state so payment and conversion can continue.
- Return stable customer display identity from the already tenant-scoped service.
- Keep direct invoices distinct from converted invoices.

## Delivery and acceptance evidence

- Repair PR #51, exact head `95a7a33a7c35db1a79ccc92d222ba62063a1735f`.
- PR Quality CI `34472613702`: PASS, including frontend archive regression, PHP/MySQL G04 archive/customer tests, deployment safety and secrets.
- Merge `5b52d288dc6750ebc1ef90bf372a9d413800ff1e`; main CI `34472752526`: PASS.
- Exact-SHA cPanel staging deploy `34472945059`: PASS.
- Live health G04, unauthenticated API rejection, new asset hashes and staging noindex smoke: PASS.
- Owner accepted the repaired workflow on 2026-09-10.

The owner also approved the future G07 customer-centric history contract: default `مشتری‌ها` cards plus `همه اسناد`, search by stable customer/contact/document identity, per-customer chronological document/payment/conversion history and no converted-sale double counting. The full contract is recorded on Issue #8 and is intentionally not pulled into G05.

G04 is PASS / CLOSED. G05 / Issue #6 is ACTIVE. Real iOS remains DEFERRED / NOT PASSED to G08 before G09.
