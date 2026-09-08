# G01 Implementation & Acceptance

Gate: G01 / Issue #2
Status: implementation merged; hosting runtime confirmed; direct staging deployment setup + real Telegram device acceptance pending.

## Deployment target decision

Owner correction on 2026-09-08: V1 will run on the owner's existing **Shataban Host shared hosting in Germany**, not Hetzner. The same account currently serves `box4u.co`.

This does not change G00 architecture. The app remains static TypeScript/React + PHP/MySQL and shared-host compatible.

Confirmed hosting/runtime evidence now includes:
- Germany location;
- approximately 9 GB account storage with ~2.14 GB free at evidence time;
- 2 GHz dedicated CPU allocation shown by the plan;
- 2 GB dedicated RAM;
- 30 entry-process / 100 process limits;
- Apache 2.4.68;
- MariaDB 10.6.28;
- PHP 8.2 available;
- PHP `memory_limit=1024M`;
- `max_execution_time=300`;
- `post_max_size=512M`;
- `upload_max_filesize=512M`;
- required G01 PHP extensions available.

See `docs/g01/G01_SHATABAN_HOSTING_EVIDENCE_2026-09-08.md`.

Existing Box4U PHP/domain settings are not changed by this project. The Mini App uses a new isolated subdomain with its own PHP 8.2 assignment, document root, database and secrets.

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

## Direct staging deployment — artifact-free normal path

Owner requested GitHub-to-cPanel deployment with routine GitHub artifact use minimized.

G01 therefore uses:
- `.github/workflows/g01-ci.yml` for normal CI/security coverage;
- `.github/workflows/g01-deploy-staging.yml` for direct staging deployment;
- `scripts/prepare-shared-host-release.sh` to assemble the release in ephemeral runner storage;
- `scripts/deploy-ftps.sh` to deploy directly to cPanel via encrypted explicit FTPS;
- a dedicated `deploy/staging` branch/ref as the exact commit pointer that is allowed to deploy to staging.

Routine deployment does **not** upload a GitHub Actions artifact. The old routine artifact-upload workflow is removed.

Deployment safety rules:
- FTPS credentials must belong to a cPanel FTP account jailed to the dedicated Mini App staging application root;
- the FTP account must not expose the cPanel account home, Box4U WordPress root or unrelated sites;
- `server/.env` is excluded from normal mirror deletion/upload so runtime secrets remain server-side;
- the workflow downloads the prior staging file tree into ephemeral runner storage before upload;
- failed upload or failed `/api/v1/health` smoke check triggers same-run file rollback;
- TLS certificate verification remains enabled; do not disable FTPS certificate verification to make deployment pass.

This rollback is sufficient for G01 staging. Production-grade atomic deployment/database rollback remains G08 scope.

`deploy/staging` is not created/moved until the isolated cPanel staging root and GitHub Secrets are configured. After that, moving the ref to an accepted `main` SHA triggers deployment and makes the deployed commit explicit.

## CI

`.github/workflows/g01-ci.yml` runs:
- Node 22 frontend install/typecheck/test/build/secret scan
- PHP 8.2 syntax/unit/integration tests with MySQL 8.4 service
- repository secret scan

The staging deploy workflow repeats the relevant build/security/integration checks before any network deployment. Direct dependency versions are pinned in `package.json`; dependency lockfile hardening remains due no later than G08 if not already added.

## Human actions required for final G01 acceptance

Only the actions that require control-panel/credential/device ownership remain human-operated:

1. create the dedicated staging subdomain with document root ending in `server/public`;
2. assign PHP 8.2 only to that staging subdomain;
3. create the dedicated staging DB and DB user;
4. create a dedicated FTP account jailed to the Mini App staging application root;
5. add the four deployment values to GitHub repository Secrets: `STAGING_FTPS_HOST`, `STAGING_FTPS_USER`, `STAGING_FTPS_PASSWORD`, `STAGING_ORIGIN` — never paste their secret values into chat/issues;
6. create/configure the staging/test Telegram bot and keep its token only in server-side runtime configuration;
7. run the initial DB migration/runtime `.env` setup;
8. complete Android/iOS/Desktop Telegram launch matrix in `BOTFATHER_AND_DEPLOYMENT_CHECKLIST.md`.

Once the four deploy Secrets and isolated staging root exist, GitHub deployment/ref movement can be performed through the repository workflow without the owner manually uploading release files.

## Gate decision

Do not close G01 solely from CI or hosting compatibility. Issue #2 manual acceptance items (real Telegram Android/iOS/Desktop, light/dark and safe-area/viewport) must PASS on the configured staging Mini App first.
