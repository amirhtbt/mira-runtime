# G05 Versioned Template System

## Approved catalogue

G05 ships six restrained-colour templates: Minimal, Luxury, Boutique, Modern Business, Bazaar, and Classic Business. Every template is versioned (`id@1`) and supports both `portrait` and `landscape`, for 12 selectable variants.

## Rendering contract

Templates consume one normalized, immutable `InvoiceViewModel`; they do not query storage, call APIs, or recalculate totals. All monetary fields are integer strings in Rial and all headings explicitly say «ریال». A template switch changes presentation only and can never change an authoritative amount.

Every template conditionally accommodates every V1 field when defined: seller/logo/contact/legal data, customer/contact/legal data, document number/dates/order number, SKU/description/unit/quantity, line price/discount/tax/total, document discount/tax/shipping/service fee/custom adjustments/grand total, payment destination, notes/terms, footer, thanks, and signature/stamp areas. Undefined optional values produce neither blank labels nor empty blocks.

For final invoices, installment and deposit history remains linked in the domain but is never included in the printable view model. That history is visible only on the source proforma inside the app.

## Versioning and historical output

Template IDs are stable and versions are append-only. Issued document snapshots keep the selected ID/version. Existing issued Toman documents are preserved as historical records; G05 normalizes business defaults and creates all new documents in integer Rial.

## Acceptance fixtures

Every template/orientation combination passes the same fixtures: 1, 20, and 100 items; long Persian titles; mixed SKU; optional fields present/absent; discounts, tax, shipping, service fee and adjustments; payment destination; notes and signatures; large integer Rial values; and no occurrence of «تومان» in new output.

PDF/image export and pagination mechanics are G06 scope; the renderer is export-ready but G05 does not claim those gates.
