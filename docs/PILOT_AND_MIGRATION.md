# Pilot, Feedback & Future Migration

## 1. Pilot philosophy

V1 is a learning instrument, not a crippled free plan.
Users should experience the full core value before monetization is tested.

## 2. Events to measure

Privacy-safe event examples:
- app_open
- new_invoice_started
- first_item_added
- invoice_completed
- template_selected (template id only)
- image_exported
- pdf_exported
- share_started
- invoice_duplicated
- settings_section_used
- feedback_submitted

Never put customer names, phone numbers, product descriptions, card numbers or invoice note content into event properties.

G09 uses first-party database events with a server-side allowlist. Unknown event names and property keys are rejected. Document/customer IDs are not analytics properties; conversion, export and completion outcomes are aggregated from authoritative tenant-scoped tables. Optional feedback text is stored separately from analytics and explicitly warns users not to enter customer or invoice data.

## 3. Core metrics

### Activation
% of new users who produce their first exportable invoice.

### Speed
median / p75 time from first launch to first completed invoice.

### Retention
D1, D7, D30 seller return rate.

### Habit/value
invoices created per weekly active seller.

### Sharing
% completed invoices that are exported/shared.

### Quality
error/crash/export failure rate.

## 4. Feedback prompts

Do not interrupt the first invoice.
Good trigger examples:
- after 3 successful invoices
- after second active day

Keep feedback short:
- 1–5 value score
- optional text
- optional `چه چیزی کم داشت؟`

Eligibility is calculated server-side: at least three issued documents or activity on a second distinct day. A submitted prompt is not shown again. The first invoice is never blocked or interrupted.

## 5. Positive-signal criteria for expansion

G10 should evaluate evidence rather than a single vanity metric. Strong signals include:
- users return without reminders
- repeat invoice creation is frequent
- sharing/export is high
- sellers request business features voluntarily
- users ask for web/desktop/team/payment capabilities
- support burden remains manageable

Thresholds should be frozen after initial baseline data, not invented retrospectively to justify a decision.

## 6. Future paid system migration

Core rule: Telegram users keep all invoices and settings.

Later identity flow:
- existing internal `user_id`
- Telegram identity stays linked
- user adds phone/email/web credential
- new web account resolves to the same `user_id`

Paid entitlements attach to user/business, not Telegram ID.

## 7. Future tiers (not V1 commitment)

Possible Free:
- core invoice creation
- basic templates

Possible Pro:
- premium templates
- advanced branding
- team/multiple businesses
- web access
- deeper history/analytics
- live invoice/payment features
- automation/integrations

Pricing must not be fixed until pilot behavior and willingness-to-pay research exist.
