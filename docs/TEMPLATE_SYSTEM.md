# G05 Template System

## Approved catalogue

The V1 catalogue has three genuinely different structures: `minimal`, `modern-business`, and `classic-business`. Every template is A4 landscape (297×210 mm). Portrait and the former colour-only catalogue entries are removed.

Layout and colour are independent choices. The Templates tab offers four restrained presets plus a custom accent. Changing colour never changes structure, data or authoritative totals.

## Product surface

`قالب‌ها` is the fifth bottom-navigation destination and the first visible button from the left in RTL. It is the only place to select the active template/theme. Settings no longer contains a default-template selector or template preview.

The catalogue uses organised cards with real thumbnails and an explicit active state. A separate preview area provides fit/zoom controls. Full preview opens in a dedicated dialog, with template explanation beside the sheet and never over it.

## Persistence and issuance

The active `visual.templateId` and accent are persisted through business settings. Finalization stores the settings in the immutable document snapshot, so all subsequently issued documents use the active choice while historical issued output remains reproducible. Migration 006 maps removed editable defaults to the nearest retained layout without modifying issued snapshots.

## Rendering contract

Templates consume one normalized immutable `InvoiceViewModel`; they never query storage or calculate totals. All money is an integer Rial string. All three layouts conditionally support every defined V1 seller, customer, document, item, financial, payment-destination, note, footer and signature field. Undefined optional values produce no labels or reserved blank blocks.

Pro-forma deposit/installment history remains linked in the application. Final invoice output excludes that breakdown.

## Acceptance

Required automated coverage includes the exact three-entry registry, landscape-only output, structural distinction, active-choice persistence, theme independence, conditional fields, 1/20/100-row fixtures, Rial-only rendering, five-slot RTL navigation, zoom/full-preview operation and no page-level mobile overflow.

PDF/image generation and export pagination remain G06 scope.
