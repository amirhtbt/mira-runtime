# G04 Archive Acceptance Repair — 2026-09-10

Status: IMPLEMENTED / VERIFICATION AND REDEPLOY PENDING

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

G04 remains open. Exact PR/CI/deploy/smoke evidence will be appended after verified delivery, followed by renewed owner acceptance on Telegram Desktop and Android.
