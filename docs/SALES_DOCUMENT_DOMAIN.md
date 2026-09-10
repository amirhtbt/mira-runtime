# Sales Document Domain

This document is the V1 source of truth for pro-forma invoices, invoices, conversion, payments and customer history.

## 1. Product rule

Mira has one simple sales-document experience with two explicit document types:

- `proforma` — پیش‌فاکتور; the commercial offer and the V1 record against which deposits/installments and remaining amount are tracked.
- `invoice` — فاکتور فروش; the final document issued only after the full document total has been paid/confirmed.

Both types use the same item editor, deterministic calculation engine, template system and visual layout. Type controls the visible label, numbering sequence, lifecycle rules and financial meaning; it must never be inferred from a custom display label.

The primary UI action remains one action: `سند جدید`. The next surface offers only two clear choices and defaults to `پیش‌فاکتور`. Advanced settings remain outside the normal create path.

## 2. Aggregate and records

Use a single `sales_documents` aggregate/table rather than separate pro-forma and invoice implementations. The physical name may remain `invoices` during implementation only if its API and domain vocabulary are corrected before G04 acceptance.

Minimum document fields:

- stable internal ID and `business_id`
- optional stable `customer_id`
- `document_type`: `proforma | invoice`
- type-specific sequence number and display label
- lifecycle status and timestamps
- authoritative totals in integer base units
- `source_document_id` on an invoice created from a pro-forma
- immutable finalized snapshot/version metadata

Supporting entities:

- `sales_document_items`
- `sales_document_adjustments`
- `sales_document_snapshots`
- `payments`
- `payment_allocations`

All customer, document, conversion and payment queries are authorized by server-derived `business_id` scope. A source and converted document must belong to the same business and customer scope.

## 3. Lifecycle and conversion

Shared document lifecycle: `draft -> ready -> issued/shared -> archived`, with cancellation as an explicit terminal business action.

Conversion rules for V1:

1. Only an eligible, non-cancelled and fully paid pro-forma can be converted.
2. Conversion creates a new invoice; it never relabels or mutates the original pro-forma.
3. The new invoice copies the authoritative commercial data, records `source_document_id` and is marked settled for its full total.
4. The source pro-forma remains visible in history with a `converted` marker and a link to its invoice.
5. Conversion is idempotent. Repeating the same request returns the existing result instead of creating duplicates.
6. V1 supports one primary invoice per pro-forma. Split/partial invoicing is a later explicit capability, not implicit V1 behavior.
7. Each type has its own numbering sequence; conversion never reuses the pro-forma number as the invoice number.

Before full payment, the detail action is `ثبت پرداخت`. Once the confirmed payment sum equals the total, one prominent `صدور فاکتور نهایی` action becomes available. The user reviews the result and confirms; the normal renderer is reused rather than introducing a separate wizard.

A seller may also create a final invoice directly for an already fully paid sale. That path requires one explicit `پرداخت کامل شده` confirmation; it does not create invented installment records.

## 4. Payments and balances

Payments are append-only business records with amount in integer base units, paid timestamp, optional method/reference/note and `confirmed | void` status. `payment_allocations` link confirmed amounts to the source pro-forma.

V1 UI records deposits/installments against pro-formas. The pro-forma payment progress is derived, not manually contradictory:

- `unpaid`: confirmed allocated amount is zero
- `partial`: greater than zero and less than invoice total
- `paid`: equal to invoice total
- `overpaid`: greater than invoice total, shown explicitly rather than silently discarded
- `cancelled`: document is cancelled; allocations remain auditable

Overpayment is blocked in the normal V1 flow; imported/corrected overpayment is shown explicitly and must be resolved before final invoice issuance. Voiding a payment creates/records an auditable state change; financial history is not hard-deleted.

The final invoice shows the full invoiced total and settled state only. It does not print or expose the installment breakdown (for example 3 million deposit + 7 million completion payment). That detailed history remains attached to the source pro-forma inside the application. Payment-gateway collection and a full accounting ledger remain outside V1.

## 5. Customer history

Every saved customer has one chronological history containing both document types, their conversion links, pro-forma payment progress and final invoices. Search/filter can narrow by type, lifecycle, settlement status and date.

Finalized documents retain their customer display snapshot even if the saved customer is later edited. The stable `customer_id` still groups them on the customer page. Customer saving remains optional: document creation can use an unsaved/free-text customer, but cross-document customer history requires a stable customer record.

Confirmed deposits/installments and remaining amounts are derived from active pro-formas. Final invoiced sales are derived from issued final invoices. These figures remain separate so a converted sale is never double-counted.

## 6. Conversion metric

The canonical pro-forma-to-invoice conversion rate is link/event based, never inferred from matching customer names, numbers or amounts:

`distinct eligible issued pro-formas with a linked invoice / distinct eligible issued pro-formas`

Draft and cancelled pro-formas are excluded. Reports use the pro-forma issue-date cohort and state the observation window (for example 30 days) so recent quotes are not misleadingly compared with mature cohorts. Analytics receives opaque document IDs/type/status events only; customer identity and document contents are excluded.

## 7. Required invariants

- renderer/template code cannot change totals or financial meaning;
- conversion cannot cross business or customer scope;
- an idempotency key cannot produce multiple invoices;
- confirmed allocations are summed with deterministic integer arithmetic;
- a final invoice cannot be issued from a pro-forma whose confirmed payment sum is below or above its total;
- installment details remain internal to the pro-forma and are not rendered on the final invoice;
- converted pro-forma payments and the final invoice are never double-counted;
- finalized snapshots and conversion links survive later settings/customer/template changes;
- payment and conversion audit records are retained according to the product retention policy.
