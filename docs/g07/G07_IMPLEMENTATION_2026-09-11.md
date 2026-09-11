# G07 — History, search and reuse

Status: **IMPLEMENTED — AWAITING EXACT-HEAD CI, STAGING AND OWNER ACCEPTANCE**

## Scope

- Tenant-scoped server search by customer name, phone, document number, item title and item description.
- Filters for document type, lifecycle and settlement state.
- Stable `(created_at,id)` cursor pagination with a maximum page size of 50.
- Customer-grouped RTL history showing pro-formas and invoices together, payment remainder and explicit conversion linkage.
- Non-destructive archive/unarchive separated from active history.
- Duplicate-to-draft flow that recalculates integer Rial totals, keeps the original immutable and carries the source document settings snapshot where available.
- Database indexes for business/history and document-number query paths.

## Security and correctness

- `business_id` comes only from the authenticated session.
- Search, archive, duplicate and open operations enforce tenant ownership.
- User query text is parameterized and LIKE wildcards are escaped.
- Finalized source documents are never updated by reuse actions.
- Archive is reversible; it is not deletion.

## Acceptance matrix

- Search by customer, phone, number and item.
- Type/status filters and empty states.
- One customer folder containing both linked pro-forma and invoice.
- Duplicate opens an independent draft with the same items/totals/template.
- Archive hides a record; archive view shows it; restore returns it.
- More than 20 records paginate without duplicates.
- A second Telegram account cannot find/open/archive/duplicate another tenant's records.

Production remains out of scope. Real iOS remains deferred to G08 before G09.
