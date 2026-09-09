# Sales Document Domain

This document is the V1 source of truth for pro-forma invoices, invoices, conversion, payments and customer history.

## 1. Product rule

Mira has one simple sales-document experience with two explicit document types:

- `proforma` — پیش‌فاکتور; a quote/offer, not revenue and not payable in V1.
- `invoice` — فاکتور فروش; the issued commercial document against which payments and balance are recorded.

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

1. Only an eligible, non-cancelled pro-forma can be converted.
2. Conversion creates a new invoice; it never relabels or mutates the original pro-forma.
3. The new invoice copies the authoritative commercial data and records `source_document_id`.
4. The source pro-forma remains visible in history with a `converted` marker and a link to its invoice.
5. Conversion is idempotent. Repeating the same request returns the existing result instead of creating duplicates.
6. V1 supports one primary invoice per pro-forma. Split/partial invoicing is a later explicit capability, not implicit V1 behavior.
7. Each type has its own numbering sequence; conversion never reuses the pro-forma number as the invoice number.

The conversion action is one prominent `تبدیل به فاکتور` action on an eligible pro-forma. The user reviews the result and confirms; the normal item editor is reused rather than introducing a separate wizard.

## 4. Payments and balances

Payments are append-only business records with amount in integer base units, paid timestamp, optional method/reference/note and `confirmed | void` status. `payment_allocations` link confirmed amounts to an invoice.

V1 UI records payments against invoices only. Pro-formas never count as receivables, revenue or paid sales. The invoice financial status is derived, not manually contradictory:

- `unpaid`: confirmed allocated amount is zero
- `partial`: greater than zero and less than invoice total
- `paid`: equal to invoice total
- `overpaid`: greater than invoice total, shown explicitly rather than silently discarded
- `cancelled`: document is cancelled; allocations remain auditable

Voiding a payment creates/records an auditable state change; financial history is not hard-deleted. Payment-gateway collection and a full accounting ledger remain outside V1.

## 5. Customer history

Every saved customer has one chronological history containing both document types, their conversion links, totals and invoice payment/balance summary. Search/filter can narrow by type, lifecycle, financial status and date.

Finalized documents retain their customer display snapshot even if the saved customer is later edited. The stable `customer_id` still groups them on the customer page. Customer saving remains optional: document creation can use an unsaved/free-text customer, but cross-document customer history requires a stable customer record.

Customer totals are derived from invoices and confirmed payment allocations only. Pro-formas may be shown as pipeline value but are never mixed into billed, paid or outstanding amounts.

## 6. Conversion metric

The canonical pro-forma-to-invoice conversion rate is link/event based, never inferred from matching customer names, numbers or amounts:

`distinct eligible issued pro-formas with a linked invoice / distinct eligible issued pro-formas`

Draft and cancelled pro-formas are excluded. Reports use the pro-forma issue-date cohort and state the observation window (for example 30 days) so recent quotes are not misleadingly compared with mature cohorts. Analytics receives opaque document IDs/type/status events only; customer identity and document contents are excluded.

## 7. Required invariants

- renderer/template code cannot change totals or financial meaning;
- conversion cannot cross business or customer scope;
- an idempotency key cannot produce multiple invoices;
- confirmed allocations are summed with deterministic integer arithmetic;
- pro-formas are excluded from billed/paid/outstanding totals;
- finalized snapshots and conversion links survive later settings/customer/template changes;
- payment and conversion audit records are retained according to the product retention policy.

