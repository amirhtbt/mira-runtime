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
9. Telegram launch data is a short-lived authentication input, not a long-lived application credential.
10. Historical invoice output is reproduced from immutable authoritative snapshots, not from current settings or recalculation.

## 2. Proposed V1 stack

### Client
- TypeScript
- React + Vite (or equivalent lightweight component framework)
- Telegram Mini App JS integration isolated behind an adapter
- RTL-first CSS/design tokens
- animation library kept intentionally lightweight
- static production build; no permanent Node.js process required on the production host

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
- OpenSSL
- fileinfo
- PDO MySQL
- intl preferred
- GD or Imagick preferred for server-side image work
- file upload support
- mod_rewrite or equivalent routing
- Cron
- backup capability
- writable isolated application storage outside public paths where possible

The critical invoice creation path must work even if the host cannot reach Telegram Bot API endpoints.

## 4. Telegram integration

### 4.1 Authentication input

- Receive raw `Telegram.WebApp.initData` on the client.
- Send the raw launch string to the backend over same-origin HTTPS.
- Never authorize from `initDataUnsafe` or from a Telegram user object supplied separately by the client.
- Validate the raw data server-side using Telegram's documented Mini App validation algorithm.
- The V1 backend owns the bot token, so the token-based HMAC-SHA-256 verification path is the selected G01 implementation. Telegram's Ed25519 third-party verification path is not required for V1.

### 4.2 Strict validation rules

The G01 validator must:
- parse the query string without silently normalizing keys;
- reject malformed encoding and duplicate security-sensitive fields such as `hash`, `auth_date`, `user` and `query_id` when present;
- exclude `hash` from the data-check-string exactly as required by Telegram;
- sort fields deterministically and calculate the Telegram HMAC exactly per the official algorithm;
- compare the received and calculated hash in constant time;
- validate `auth_date` against a configurable short maximum age and small clock-skew allowance;
- reject timestamps unreasonably in the future;
- only parse/use the Telegram `user` JSON after integrity validation succeeds.

Do not use PHP `parse_str()` as the security boundary if its key normalization/duplicate collapsing could change the signed field set; use a strict parser with explicit duplicate handling.

### 4.3 Replay policy and session exchange

Telegram documents freshness through `auth_date` but does not define an application replay policy. V1 therefore defines one explicitly:

1. Raw `initData` is accepted only during the configured short authentication window.
2. After validation, the server maps `(provider=telegram, telegram_user_id)` to an internal user identity and issues an opaque application session.
3. Raw `initData` is never used as a long-lived bearer token for normal API calls.
4. The backend stores a cryptographic fingerprint of accepted launch data for the freshness window so repeated session-mint attempts can be rejected or handled idempotently according to the session issuance rule.
5. A replay attempt can never change the mapped internal user or business scope based on client-supplied IDs.

The exact default freshness window is an application policy and must be frozen/tested in G01 configuration rather than presented as a Telegram-mandated value.

### 4.4 Application session

Preferred V1 model for the same-origin Mini App/API deployment:
- cryptographically random opaque session ID;
- server-side session record in MySQL so shared hosting does not depend on a daemon/Redis;
- cookie marked `Secure`, `HttpOnly`, `Path=/`, with no broad `Domain` attribute; use a `__Host-` cookie name where supported by the chosen deployment path;
- conservative `SameSite` policy compatible with accepted Telegram Android/iOS/Desktop clients;
- idle and absolute expiry;
- session rotation on authentication and sensitive lifecycle transitions;
- explicit logout/revocation support;
- no access/session token stored in `localStorage`.

For cookie-authenticated state-changing API calls, enforce same-origin request policy (including `Origin` validation where available) and a CSRF defense appropriate to the final session implementation. G01 compatibility tests decide the final cookie/CSRF combination; security must not be weakened to accommodate one client without evidence.

### 4.5 Telegram adapter

All Telegram-specific client calls are hidden behind an adapter so a future web app can replace them without rewriting domain UI.

Adapter may expose:
- ready/expand
- theme parameters
- safe area / content safe area / viewport
- back button
- main/bottom button
- haptic feedback
- device/secure storage where appropriate
- share flow
- external/Telegram link opening
- close confirmation

Telegram-version capability checks belong inside the adapter. Domain UI must have safe no-op/fallback behavior when a Telegram method is unavailable on a client version.

### 4.6 Origin boundary

As of 2026-07-20 Telegram automatically hardens Mini App methods against use from origins different from the original Mini App domain.

Therefore:
- production and staging are separate explicit origins;
- staging and production should use separate bot credentials/configuration where practical and must never share production secrets/database state;
- an active Mini App must not navigate cross-origin and expect Telegram-native methods to keep working;
- external destinations are opened through the Telegram adapter (`openLink` / `openTelegramLink` or a documented equivalent) instead of replacing the application origin;
- frontend and API should stay same-origin in V1 unless a later gate records a tested reason to change this.

### 4.7 Bot backend dependency

The product must not require continuous/synchronous Bot API calls just to create, calculate, save, finalize or export an invoice.

If outbound Telegram Bot API access from an Iran host is unreliable or blocked, notification/bot messaging stays behind an optional replaceable integration/relay boundary. Failure of that integration must not corrupt invoice state.

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
- sessions
- app_events (privacy-safe telemetry)
- migrations

### Identity rule
`users.id` = internal UUID / stable internal key.
Telegram ID is an identity mapping, not the primary domain identity.

`telegram_identities` must enforce uniqueness for the Telegram provider identity and map to exactly one internal user. Client-provided Telegram IDs are never accepted as an authorization scope by themselves.

This enables later mapping of the same user to:
- phone
- email
- web login
- organization membership
without re-keying all invoices.

## 6. Multi-tenant readiness

Even if V1 allows one business per user, user-owned domain data should be scoped by `business_id` where applicable. Authorization derives the permitted business scope from the authenticated internal user/session on the server; the client cannot grant itself access merely by submitting another `business_id`.

This avoids a destructive migration when multiple stores/teams arrive later while keeping multi-user organizations out of V1 scope.

## 7. Invoice snapshotting

Every finalized/exported invoice must preserve an immutable authoritative snapshot.

Minimum snapshot fields:
- snapshot schema version
- seller display data used
- customer display data used
- item rows and authoritative precomputed line totals
- adjustments and authoritative final totals
- currency/base-unit representation used by the engine
- number/date/currency presentation settings used
- calculation/rounding policy version
- template stable ID and immutable template version
- relevant notes/terms/payment details
- finalized/created timestamps needed for the historical document

Rules:
- changing a business profile or template later must not alter historical output;
- historical rendering must not require recalculating totals with a newer engine;
- editing a finalized historical invoice creates a new draft/clone rather than mutating the immutable snapshot;
- exports reference the exact snapshot/template version they rendered.

## 8. API versioning

Use explicit versioning, e.g. `/api/v1/...`.

Never expose database table shape directly as the API contract.

## 9. Files

V1 stores only files required by accepted gates, primarily seller logos and generated exports.

Rules:
- validate MIME by file content, not only extension or browser-provided type;
- strict byte and pixel/dimension caps;
- randomized non-guessable storage names;
- no executable upload types;
- store private/source uploads outside the public web root where host capability permits;
- serve private files through authorization checks or signed/opaque references as appropriate;
- V1 logo upload defaults to safe raster formats such as PNG/JPEG/WebP;
- SVG is not accepted as a normal V1 logo upload. If added later, it requires explicit sanitization/rasterization plus dedicated security tests;
- image processing must defend against decompression bombs/resource exhaustion.

## 10. Template package boundary

Invoice data -> normalized view model -> template renderer.

Templates must receive a documented normalized schema rather than raw database records.

Templates never query SQL and never recalculate authoritative financial totals. A template may format authoritative values for display but cannot change their numeric meaning.

## 11. Export boundary

Image/PDF export is an adapter/strategy boundary implemented in G06.

Shared-hosting compatibility means production export must not require:
- headless Chromium/Playwright on the server;
- Docker;
- a permanent Node.js process;
- a long-running rendering daemon.

G06 may choose a client-side and/or PHP-compatible renderer, but it must:
- use locally controlled/licensed Persian-capable fonts;
- render from the immutable invoice snapshot + exact template version;
- pass Persian shaping/RTL, multipage, visual regression and performance fixtures;
- preserve invoice data when export fails.

## 12. Future migration path

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
- future identities/entitlements attach to internal user/business records rather than Telegram IDs
