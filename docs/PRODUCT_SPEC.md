# Product Specification

## 1. Problem

Small sellers in Iran frequently quote prices manually in Telegram/Instagram/WhatsApp-style messages and send payment details separately. They want professional presentation without adopting accounting software.

## 2. Target users

Primary:
- Instagram/Telegram online shops
- Bazaar and retail sellers
- Home businesses
- Freelancers and service providers
- Small wholesalers
- Custom-order businesses

Secondary later:
- Sales teams
- Small companies
- Agencies
- Multi-user shops

## 3. Core experience

### First session
1. Launch Mini App from Telegram.
2. Telegram identity is verified server-side.
3. User sees one primary action: `ساخت پیش‌فاکتور`.
4. Minimal onboarding can collect only what is required to make the output useful.
5. Create invoice through a short guided flow.
6. See animated live preview.
7. Choose a visual template.
8. Export/share.
9. Only after value is delivered, encourage completing store profile/settings.

### Repeat session
- Recent invoices
- `+ پیش‌فاکتور جدید`
- Duplicate/reuse recent invoice
- Saved products/customers optional

## 4. Primary create flow

Keep the normal path minimal:

1. Customer name (optional)
2. Invoice items
   - item title
   - quantity
   - unit price
3. Optional chips
   - discount
   - shipping
   - notes
4. Live total
5. Template selection
6. Final preview
7. Export/share

Target time:
- first invoice: < 30 s for a simple invoice
- repeat invoice: < 15 s when seller profile is already saved

## 5. Advanced invoice settings

Advanced fields must be configurable globally and overridable per invoice when useful.

### Seller/profile
- business display name
- logo
- subtitle/category
- seller person name (optional)
- phone (optional)
- Telegram username (optional)
- address (optional)
- custom contact line
- card number(s)
- bank name (optional)
- card holder name
- IBAN / Sheba (optional)
- account number (optional)
- custom payment instructions
- signature image (future-capable)
- stamp image (future-capable)

### Invoice identity
- document label: پیش‌فاکتور / فاکتور فروش / quotation-style custom labels
- sequence prefix
- invoice number
- auto/manual numbering
- issue date
- validity/expiry date
- Jalali/Gregorian display
- Persian/Latin digits

### Monetary presentation
- Toman / Rial
- thousands separators
- decimals policy
- round-total policy
- global discount: fixed / percent
- line-item discount: fixed / percent
- shipping
- service fee / packaging / misc adjustment
- tax/VAT field available but disabled by default
- custom surcharge/discount rows

### Item columns
Each can be enabled/disabled in settings:
- row number
- SKU/code
- image (future-capable)
- item title
- description
- unit
- quantity
- unit price
- line discount
- tax
- line total

### Footer/terms
- seller note
- payment terms
- shipping terms
- custom footer
- validity notice
- thank-you text
- optional watermark/brand footer controlled by product policy

### Visual preferences
- default template
- accent color when template supports it
- light/dark invoice variant when supported
- logo position when template supports it
- density: compact / comfortable
- font-size profile within supported safe limits

## 6. Invoice lifecycle

V1 states:
- draft
- ready
- shared/exported
- archived

Optional lightweight manual status:
- unpaid
- paid
- cancelled

No accounting ledger is implied.

## 7. Invoice history

- list recent invoices
- search by invoice number/customer/item text
- filter by date/status
- open/preview
- duplicate
- edit draft or clone finalized invoice
- archive

## 8. Saved data

V1 can support lightweight saved:
- customers
- products/services

Both must be optional; invoice creation cannot require master-data setup.

## 9. Export/share

Required V1 outputs:
- high-quality share image (PNG/JPEG)
- PDF with correct Persian RTL rendering
- Telegram share/send flow where platform behavior permits

Potential later:
- live invoice URL
- payment link
- receipt upload
- payment confirmation

## 10. Free validation policy

V1 is free. Avoid artificial feature throttles during product-market validation.

Track:
- first-invoice activation
- completion funnel
- time-to-first-invoice
- export/share rate
- D1/D7/D30 retention
- invoices per active seller
- template usage
- advanced-settings usage
- crash/error rate
- voluntary feedback score/comments

Do not send sensitive invoice contents to analytics.

## 11. Explicit non-goals for V1

- public marketing website
- standalone browser app product
- App Store / Play Store app
- formal tax invoice compliance
- accounting ledger
- inventory management
- payroll
- supplier accounting
- complex CRM
- online payment gateway
- subscription billing
- multi-user organizations
- end-user template builder
