# G01 Implementation & Acceptance

Gate: G01 / Issue #2
Branch: `g01/telegram-foundation-auth`
Status: implementation in review; real Telegram/device acceptance pending.

## Deployment target decision

Owner decision on 2026-09-08: V1 will run on the owner's existing **Hetzner shared hosting in Germany**, not on an Iran-based production host.

This does not change the G00 architecture. The app remains static TypeScript/React + PHP/MySQL and shared-host compatible. It removes the earlier server-location constraint while preserving the rule that authoritative invoice operations never depend on synchronous Telegram Bot API availability.

Exact Hetzner package limits still need to be read from the owner's hosting account before staging acceptance. Current official Hetzner packages show that M meets the project's 256 MB PHP-memory minimum, while L/XL add SSH and more memory; L is the recommended practical baseline if the existing account can use it.

## Implemented foundation

### Frontend
- TypeScript + React + Vite static client scaffold
- official Telegram Mini App JS loaded before app bundle
- Telegram adapter for raw `initData`, ready/expand, theme, viewport, safe/content-safe-area snapshot, BackButton, haptics and external-link boundary
- same-origin API client using cookies; no bot token/client secret
- bootstrap order: reuse valid application session first, otherwise exchange fresh validated Telegram `initData`
- RTL minimal G01 shell with Telegram theme + safe-area CSS variables

### Backend
- PHP 8.2+ request/response API
- MySQL/MariaDB migration foundation
- strict server-side Telegram `initData` validator
- HMAC-SHA-256 validation per Telegram Mini App algorithm
- strict query parsing, duplicate-field rejection, malformed-encoding rejection, constant-time hash comparison
- configurable `auth_date` freshness/future-skew policy
- single-use replay fingerprint for session minting
- internal UUID user identity independent of Telegram ID
- one V1 business per internal user with tenant `business_id`
- opaque random session cookie; raw token is never stored in DB, only HMAC hash
- DB-backed idle/absolute expiry, rotation and revocation
- exact production/staging origin guard for state-changing requests
- no synchronous Bot API call in the auth/invoice foundation

### Security defaults
- `.env` ignored; `.env.example` contains placeholders only
- repository secret scan
- built client bundle secret-marker scan
- no localStorage auth token
- production/staging cookie uses `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, no Domain attribute
- server error responses do not expose secrets or raw exception details
- session renewal preserves the original absolute expiry and cannot extend session lifetime indefinitely
- session rotation takes a row lock so the same old token cannot be concurrently rotated into multiple valid replacements

## Security review fix — 2026-09-08

A pre-merge review found that the first implementation of session rotation issued a fresh absolute TTL on every renewal. That would have allowed a continuously renewed session to outlive the configured absolute lifetime.

Fix:
- rotation now preserves the original `absolute_expires_at`;
- idle expiry is capped by that original absolute deadline;
- old-session rotation is serialized with `SELECT ... FOR UPDATE`;
- regression coverage explicitly verifies that renewal never extends the original absolute lifetime.

This finding was fixed before merge and was not waived or hidden by weakening tests.

## Database foundation

G01 creates:
- `users`
- `businesses`
- `telegram_identities`
- `sessions`
- `telegram_auth_replays`
- `migrations`

Telegram numeric ID is stored only as an identity mapping; domain ownership is keyed by internal UUID/business UUID.

## Automated coverage

### PHP unit
- valid initData
- tampered user/hash
- expired auth
- future auth
- duplicate signed/security field
- malformed percent encoding
- exact origin isolation
- internal UUID independence

### DB-backed integration
- first auth creates internal user/business/session
- replay cannot mint second session
- session rotation revokes old token
- session rotation preserves original absolute expiry
- idle expiry rejects session
- separate Telegram identities produce separate user/business scopes

### Client
- non-Telegram safe fallback
- raw `initData` adapter path
- BackButton handler cleanup
- typecheck/build
- client bundle secret scan

## Shared-host artifact

G01 now includes:
- Apache same-origin routing in `server/public/.htaccess`;
- security headers suitable for Telegram Web + mobile WebViews;
- `scripts/package-shared-host.sh`;
- `.github/workflows/g01-package.yml` to produce a commit-addressed artifact.

Artifact layout keeps `server/src`, migrations and runtime `.env` outside the public document root. Hetzner subdomain Document Root should point to `server/public/` after extraction.

## CI

`.github/workflows/g01-ci.yml` runs:
- Node 22 frontend install/typecheck/test/build/secret scan
- PHP 8.2 syntax/unit/integration tests with MySQL 8.4 service
- repository secret scan

`.github/workflows/g01-package.yml` rebuilds and checks the client, then creates the shared-host deployment archive.

Direct dependency versions are pinned in `package.json`. A dependency lockfile remains a production-hardening task if it cannot be generated in the current development environment; it must be resolved no later than G08 before pilot production acceptance.

## Human actions required for final G01 acceptance

Only these require the owner/operator:

1. confirm the exact Hetzner hosting package/account limits;
2. choose/confirm production and staging HTTPS origins;
3. configure production and staging/test Mini App entries in BotFather;
4. install server-only secrets on Hetzner;
5. deploy the G01 artifact to staging and run the migration;
6. run Android/iOS/Desktop Telegram launch matrix in `BOTFATHER_AND_DEPLOYMENT_CHECKLIST.md`.

Do not paste bot tokens into GitHub or screenshots.

## Gate decision

Do not close G01 solely from CI. Issue #2 manual acceptance items (Android/iOS/Desktop, light/dark, safe-area/viewport) must PASS on the real configured Mini App first.
