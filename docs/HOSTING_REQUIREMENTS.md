# Hosting & Deployment Requirements — V1

## Deployment goal

Primary V1 deployment target is the owner's existing **Shataban Host shared hosting in Germany**. The same hosting account currently serves `box4u.co`.

This supersedes the earlier Hetzner assumption and the older Iran-host assumption. It does **not** reopen G00 architecture: the selected static frontend + PHP/MySQL shared-host design remains valid.

The authoritative invoice path must still remain functional without server-to-Telegram Bot API connectivity.

## Confirmed selected-account resources — 2026-09-08

Owner-provided cPanel/plan evidence confirms:
- package `CP-01`
- Germany location
- approximately 9 GB total account storage after purchased extension
- 6.86 GB used / approximately 2.14 GB free at evidence time
- 2 GHz dedicated CPU allocation shown on the plan
- 2 GB dedicated account RAM
- entry-process limit 30
- process limit 100
- unlimited monthly traffic
- NVMe storage
- daily / weekly backups
- cPanel 136.0 build 38
- Apache 2.4.68
- MariaDB 10.6.28
- Linux x86_64
- 2.16 GB DB disk quota with low current use
- unlimited subdomains
- addon domains unavailable (`0 / 0`)

## Confirmed PHP runtime

The account has PHP 8.2 available and G01-compatible extensions. Owner evidence confirms:
- `memory_limit=1024M`
- `max_execution_time=300`
- `post_max_size=512M`
- `upload_max_filesize=512M`
- `curl`, `fileinfo`, `json`, `mbstring`, `openssl`, `PDO`, `pdo_mysql`
- `display_errors` disabled
- `log_errors` enabled

These values exceed G01 minimums. Existing Box4U domains currently use older PHP versions; this project must not change those domains as part of G01. PHP 8.2 is assigned only to the new Mini App staging subdomain.

Detailed evidence:
- `docs/g01/G01_SHATABAN_HOSTING_EVIDENCE_2026-09-08.md`

## Required host capabilities

Mandatory:
- custom domain/subdomain
- valid HTTPS certificate
- PHP 8.2 or newer
- MySQL 8 / compatible MariaDB
- at least 256 MB PHP `memory_limit`
- cURL
- mbstring
- JSON
- OpenSSL
- fileinfo
- PDO MySQL
- writable non-public application storage where needed
- daily backup or reliable backup mechanism
- configurable PHP upload/post limits
- PHP/application error logging
- Apache `.htaccess` / rewrite support or equivalent routing

Preferred/later:
- PHP 8.3+
- OPcache
- intl
- Imagick; GD fallback
- SSH access
- Composer support
- cron jobs
- database restore tooling

SSH is helpful but not a G01 blocker because staging deployment uses direct encrypted FTPS and initial migration can be applied through phpMyAdmin if CLI is unavailable.

## Co-hosting with Box4U

The Mini App may use the same Shataban hosting account for G01/pilot, but it must remain isolated from the Box4U WordPress application.

Required boundaries:
- separate Mini App staging subdomain/origin
- separate Document Root ending at Mini App `server/public/`
- separate MySQL/MariaDB database and DB user
- separate application/session secrets
- separate Telegram bot configuration/token
- no reuse of WordPress tables or `wp-config.php` secrets
- no deployment inside the Box4U WordPress directory tree
- deployment credential jailed to the Mini App staging root only

Physical account isolation is weaker than a separate hosting account. This is acceptable for G01/pilot if application/data boundaries are enforced and account-level resource contention is monitored. G08 must revisit this if Box4U load, security blast radius or export workloads make co-hosting risky.

## Domain and environment structure

V1 has no public marketing website.

Because the current package has no addon-domain quota, G01 staging uses a technical subdomain of an already-hosted domain. Recommended current staging origin:

`https://invoice-staging.box4u.co`

This is a staging implementation detail, not the future product identity. Production origin/domain remains a later owner/product decision.

Recommended cPanel application root:

`invoice-staging/`

Recommended subdomain Document Root:

`invoice-staging/server/public/`

Production and staging remain separate application security boundaries:
- separate databases
- separate application/session secrets
- separate Telegram bot token/configuration where practical
- no production credential in staging
- no staging data promoted into production as an authentication source

Telegram Mini App origin hardening is active in 2026. Frontend + API remain same-origin in V1 and the app must not depend on cross-origin navigation for Telegram-native behavior.

## Iranian-user network policy

German hosting materially reduces the risk of server-side Telegram filtering, but the pilot audience may connect from Iran where Telegram and ordinary HTTPS connectivity can be filtered or routed through VPN/proxy paths.

Architecture rules remain:
- invoice create/calculate/save/finalize/export never requires a synchronous Bot API call;
- Telegram launch authentication uses client-provided `initData` plus local cryptographic verification and does not require a server round-trip to Telegram;
- proactive Bot API messaging remains an optional adapter;
- a Telegram/Bot API outage must not corrupt an invoice operation.

Production/pilot acceptance must still test:
- Mini App HTTPS reachability from an Iranian network;
- representative full-device VPN/proxy paths;
- DNS/TLS consistency;
- actual outbound Bot API behavior rather than assuming it.

A Telegram MTProto proxy and the Mini App WebView's ordinary HTTPS traffic are separate paths; one must not be assumed to proxy the other.

## Shared-hosting constraints

Avoid V1 dependencies on:
- permanent Node.js server process
- Redis requirement
- long-running workers
- Docker requirement
- websocket requirement
- shell daemon
- server-side headless Chromium/Playwright requirement

Use:
- static compiled frontend
- PHP request/response API
- database-backed jobs if needed
- cron-driven maintenance/background work where available
- renderer/export strategy compatible with PHP/shared hosting and/or the client

## G01 direct GitHub → cPanel deployment

Owner decision: routine deploys should avoid GitHub Actions artifact retention.

Normal G01 staging path:
1. source commit is accepted on GitHub;
2. staging release pointer is the dedicated `deploy/staging` branch/ref;
3. `.github/workflows/g01-deploy-staging.yml` rebuilds and repeats security/integration tests on that exact commit;
4. `scripts/prepare-shared-host-release.sh` builds the deploy tree only in ephemeral GitHub runner storage;
5. `scripts/deploy-ftps.sh` mirrors it directly to a dedicated cPanel FTP account over explicit TLS;
6. remote `server/.env` is preserved and never taken from Git;
7. current staging files are copied into temporary runner storage before upload;
8. `/api/v1/health` is checked after upload;
9. upload/smoke failure triggers same-run file rollback.

The dedicated FTP account MUST be jailed to the Mini App staging application root. The deployment script intentionally treats remote `./` as safe to mirror/delete. It must never be given an FTP account rooted at the cPanel home, `public_html`, or the Box4U WordPress root.

FTPS certificate verification stays enabled. A hostname with a valid matching certificate must be used; do not weaken TLS verification to make deployment pass.

The old routine artifact-upload workflow is removed. `scripts/package-shared-host.sh` may remain as an emergency/manual packaging utility, but routine staging delivery must not create a retained GitHub artifact.

This direct FTPS rollback model is accepted for **G01 staging only**. Production-grade atomic file promotion, database migration/rollback and deployment hardening remain G08 scope.

## GitHub deployment secrets

The operational staging workflow uses these repository Actions secrets (names only; values never belong in source or logs):
- `STAGING_FTPS_HOST`
- `STAGING_FTPS_USER`
- `STAGING_FTPS_PASSWORD`
- `STAGING_ORIGIN`
- `STAGING_TELEGRAM_BOT_TOKEN`
- `STAGING_SESSION_PEPPER`
- `STAGING_DB_NAME`
- `STAGING_DB_USER`
- `STAGING_DB_PASSWORD`

Application runtime secrets stay in remote `server/.env` and are not part of the deployed source tree.

Never commit secrets to GitHub or expose them in frontend bundles/logs.

## Files and exports

Host must support safe application storage for logos and generated exports where server-side persistence is used.

Current free disk (~2.14 GB at evidence time) is sufficient for G01 but must be re-reviewed before G06/G08. V1 must not assume unlimited local retention of generated PDF/image exports.

V1 must not require a server-side browser renderer. G06 must prove its Persian image/PDF export path against production-like hosting and performance fixtures.
