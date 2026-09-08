# Template System

## Goal

Allow the product team to design, add, preview, validate, version and deploy new invoice templates without changing invoice business logic.

## 1. Template architecture

Each template is a versioned package with:
- stable template id
- version
- display name
- supported capabilities
- layout renderer
- design tokens
- optional user-editable accent controls
- preview fixtures
- print/PDF rules
- image-export rules

## 2. Normalized template data contract

Templates receive a normalized `InvoiceViewModel`, for example:
- seller
- customer
- document metadata
- item rows
- adjustments
- totals
- payment details
- notes/terms
- locale/number/date settings

No template may run SQL or fetch arbitrary business data.

## 3. Capability declaration

A template declares what it supports:
- logo
- seller address
- card/sheba
- SKU
- item description
- line discount
- tax
- custom adjustments
- signature/stamp
- accent color
- compact mode
- multiple pages

The app hides unsupported controls or renders safe fallbacks.

## 4. Versioning

Never modify a live template version in a way that changes historical output.

Use:
- `minimal-v1`
- `minimal-v2`

or stable ID + internal version.

Existing invoice snapshots retain the version used at export time.

## 5. V1 starter templates

Target 5 excellent templates rather than 20 mediocre ones:
1. Minimal Clean
2. Luxury
3. Fashion / Boutique
4. Modern Business
5. Bazaar / Commerce

Each template must pass the same data stress tests.

## 6. Template test fixtures

Mandatory fixtures:
- one short item
- 20 items
- 100 items stress case
- very long Persian product name
- mixed Persian/English SKU
- zero discount
- large discount
- shipping + custom adjustment
- no customer name
- long notes
- logo portrait/landscape/square
- no logo
- very large monetary values
- Rial and Toman
- Persian and Latin digits

## 7. Template acceptance

A new template cannot ship unless:
- preview tests pass
- totals are identical to engine totals
- PDF/image export passes
- multi-page overflow works
- no clipped RTL text
- mobile preview works
- snapshot visual regression accepted
- performance remains within budget

## 8. Internal authoring

V1 template addition is developer/product-team controlled through Git + CI.
A user-facing template builder is explicitly deferred.
