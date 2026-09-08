# Architecture

## 1. Principles

1. Telegram-only product surface in V1.
2. Platform-independent domain model.
3. Internal user UUID separate from Telegram user ID.
4. Versioned data/schema and API boundaries.
5. No business logic embedded in visual templates.
6. No sensitive secrets in client-side code.
7. Shared-hosting-compatible deployment for V1.
8. Migration-ready to future web/paid products.

## 2. Proposed V1 stack

### Client
- TypeScript
- React + Vite (or equivalent lightweight component framework)
- Telegram Mini App JS integration isolated behind an adapter
- RTL-first CSS/design tokens
- animation library kept intentionally lightweight

### Server
Shared-hosting-friendly:
- PHP 8.2+
- MySQL/MariaDB
- small versioned JSON/REST API
- Composer-managed dependencies
- Cron for maintenance/background jobs when needed

A full framework may be used only if the chosen host can support it reliably and boot latency remains within budget.

## 3. Hosting baseline

Shared Iran host requirements:
- HTTPS with valid public certificate
- PHP 8.2+
- MySQL/MariaDB
- Composer workflow or deployable vendor bundle
- cURL
- mbstring
- intl preferred
- GD or Imagick preferred for server-side image work
- file upload support
- mod_rewrite or equivalent routing
- Cron
- backup capability
- writable isolated application storage outside public paths where possible

## 4. Telegram integration

### Authentication
- Receive Telegram Mini App `initData` on client.
- Send raw `initData` to backend.
- Validate Telegram signature/hash server-side according to official algorithm.
- Reject invalid/expired/replayed authentication data.
- Never trust `initDataUnsafe` alone for authorization.

### Telegram adapter
All Telegram-specific client calls are hidden behind an adapter so the future web app can replace them without rewriting domain UI.

Adapter may expose:
- ready/expand
- theme parameters
- safe area / viewport
- back button
- main/bottom button
- haptic feedback
- device/secure storage where appropriate
- share flow
- close confirmation

### Bot backend dependency
The product must not require continuous Bot API calls just to create invoices. If outbound Telegram Bot API access from an Iran host is unreliable, notification/bot messaging is isolated behind an optional external relay later.

## 5. Data model

Minimum entities:
- users
- telegram_identities
- businesses
- business_settings
- customers
- products
- invoices
- invoice_items
- invoice_adjustments
- invoice_snapshots
- templates
- template_versions
- exports
- app_events (privacy-safe telemetry)
- migrations

### Identity rule
`users.id` = internal UUID / stable internal key.
Telegram ID is an identity mapping, not the primary domain identity.

This enables later mapping of the same user to:
- phone
- email
- web login
- organization membership
without re-keying all invoices.

## 6. Multi-tenant readiness

Even if V1 allows one business per user, data should be scoped by `business_id`. This avoids a destructive migration when multiple stores/teams arrive later.

## 7. Invoice snapshotting

Every exported/finalized invoice should preserve an immutable snapshot of:
- seller display data
- customer display data
- items
- totals
- settings used
- template id/version

Changing a business profile or template later must not silently alter old exported invoices.

## 8. API versioning

Use explicit versioning, e.g. `/api/v1/...`.

Never expose database table shape directly as the API contract.

## 9. Files

Store:
- logo
- signature/stamp if enabled later
- export files if server-generated

Rules:
- validate MIME by content, not only extension
- strict size caps
- randomized non-guessable filenames
- no executable upload types
- protect private source uploads

## 10. Template package boundary

Invoice data -> normalized view model -> template renderer.

Templates must receive a documented normalized schema rather than raw database records.

## 11. Future migration path

The future platform can add:
- standalone web client
- public website
- paid plans
- team accounts
- payment collection
- live invoice pages
- advanced CRM/inventory/accounting integrations

without changing the core invoice IDs or seller history.

Required migration guarantees:
- exportable user/business data
- schema migrations are forward controlled
- templates are versioned
- API contracts versioned
- internal identity independent of Telegram
- no hard-coded t.me usernames in primary keys/data ownership
