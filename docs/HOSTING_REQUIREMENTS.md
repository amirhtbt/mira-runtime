# Hosting & Deployment Requirements — V1

## Deployment goal

Primary V1 deployment target is the owner's existing **Shataban Host shared hosting in Germany**. The same hosting account currently serves `box4u.co`.

This supersedes the earlier Hetzner assumption and the older Iran-host assumption. It does **not** reopen G00 architecture: the selected static frontend + PHP/MySQL shared-host design remains valid.

The authoritative invoice path must still remain functional without server-to-Telegram Bot API connectivity.

## Known selected-account resources — 2026-09-08

Owner-provided plan evidence currently shows:
- Germany location
- 1 GB base storage + 8 GB purchased extra, approximately 9 GB total account storage
- 2 GHz dedicated CPU allocation shown on the owner's plan
- 2 GB dedicated RAM
- unlimited monthly traffic
- NVMe storage
- daily / weekly backups

These account-level resources are adequate for G01 staging and are reasonable for the initial V1 pilot. They are shared with the existing `box4u.co` workload, so resource contention must be measured rather than assumed absent.

Detailed evidence and remaining checks:
- `docs/g01/G01_SHATABAN_HOSTING_EVIDENCE_2026-09-08.md`

## Required host capabilities

Mandatory:
- custom domain/subdomain
- valid HTTPS certificate
- PHP 8.2 or newer
- MySQL 8 / MariaDB equivalent
- at least 256 MB PHP `memory_limit`; 512 MB preferred for later export work
- cURL
- mbstring
- JSON
- OpenSSL
- fileinfo
- PDO MySQL
- writable non-public application storage where the provider permits it
- cron jobs
- daily backup or reliable backup mechanism
- configurable PHP upload/post limits
- access to PHP error logs or an equivalent application logging path
- Apache `mod_rewrite` / `.htaccess` support or equivalent routing for the G01 shared-host artifact

Preferred:
- PHP 8.3+
- OPcache
- intl
- Imagick; GD fallback
- SSH access
- Composer support
- staging subdomain
- database restore tooling
- access/error logs

## Runtime limits still to verify

The hosting-plan screenshot proves account CPU/RAM/storage/location but does not prove PHP/runtime limits. Before staging acceptance, record:
- PHP version selectable for the Mini App subdomain
- PHP `memory_limit`
- concurrent PHP workers/processes if exposed
- `max_execution_time`
- `upload_max_filesize`
- `post_max_size`
- DB quota/connections
- cron count/frequency
- SSH availability
- backup retention/restore capability
- outbound HTTPS behavior

If PHP `memory_limit` is below 256 MB, record it as a G01 hosting blocker until the account configuration/plan is changed or an explicit architecture exception is accepted.

## Co-hosting with Box4U

The Mini App may use the same Shataban hosting account for G01/pilot, but it must remain isolated from the Box4U WordPress application.

Required boundaries:
- separate Mini App subdomain/origin
- separate Document Root
- separate MySQL/MariaDB database and DB user where supported
- separate application/session secrets
- separate Telegram bot configuration/token
- no reuse of WordPress tables or `wp-config.php` secrets
- no deployment inside the Box4U WordPress directory tree

Physical account isolation is weaker than a separate hosting account. This is acceptable for G01/pilot if application/data boundaries are enforced and account-level resource contention is monitored. G08 must revisit this if Box4U load, security blast radius or export workloads make co-hosting risky.

## Domain and environment structure

V1 has no public marketing website.

Recommended logical layout:
- `app.<chosen-domain>` = production Telegram Mini App frontend + API
- `staging.<chosen-domain>` = staging/test environment

Do not assume the Mini App must use the `box4u.co` domain merely because it shares the same hosting account. The product domain/origin should be chosen independently.

Production and staging are separate application security boundaries even if they temporarily share the same hosting account:
- separate databases
- separate application/session secrets
- separate Telegram bot token/configuration where practical
- no production credential in staging
- no staging data promoted into production as an authentication source

Telegram's Mini App origin hardening is active in 2026. Frontend + API therefore remain same-origin in V1 and the app must not navigate between staging and production origins while expecting Telegram-native methods to continue working.

## Iranian-user network policy

German hosting materially reduces the risk of server-side Telegram filtering, but the pilot audience may connect from Iran where Telegram and ordinary HTTPS connectivity can be filtered or routed through VPN/proxy paths.

Architecture rules remain:
- invoice create/calculate/save/finalize/export never requires a synchronous Bot API call;
- Telegram launch authentication uses client-provided `initData` plus local cryptographic verification and does not require a server round-trip to Telegram;
- proactive Bot API messaging remains an optional adapter;
- a Telegram/Bot API outage must not corrupt an invoice operation.

Production acceptance must still test:
- Mini App HTTPS reachability from an Iranian network;
- representative full-device VPN/proxy paths used by the pilot audience;
- DNS/TLS consistency;
- actual outbound Bot API behavior from the selected account rather than assuming it.

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
- cron-driven maintenance/background work
- renderer/export strategy compatible with PHP/shared hosting and/or the client

## G01 shared-host artifact layout

G01 CI produces an immutable shared-host archive. After extraction, use:
- `server/public/` as the Mini App subdomain's **Document Root**
- `server/.env` for runtime secrets/configuration, kept outside the public document root
- `server/bin/migrate.php` for controlled CLI migrations when SSH is available
- `server/migrations/` as the source for a controlled phpMyAdmin import when SSH is unavailable

The package copies the compiled Vite assets into `server/public/` and retains the PHP API front controller plus Apache `.htaccess` routing so frontend and API are same-origin.

## Frontend build/deployment

Recommended:
1. Build TypeScript/React frontend in CI, not on production hosting.
2. Run type/unit/security tests.
3. Produce immutable static frontend assets.
4. Package PHP server source outside the web document root.
5. Produce a deploy artifact traceable to commit SHA.
6. Deploy artifact to staging first.
7. Install server-only `.env` values.
8. Run controlled schema migration.
9. Run health/auth smoke checks.
10. Complete Telegram Android/iOS/Desktop acceptance.
11. Promote the same accepted commit/artifact to production later.

Never edit production source manually as the normal workflow.

## Files and exports

Host must support safe application storage for logos and generated exports where server-side persistence is used.

V1 must not require a server-side browser renderer. G06 must prove its Persian image/PDF export path against the documented performance and visual fixtures on production-like Shataban hosting.

## Secrets

Host/server only:
- Telegram bot token
- application/session secret
- database credentials
- any future third-party credentials

Rules:
- never commit secrets to GitHub;
- never expose secrets in frontend bundles;
- staging and production use distinct secrets;
- CI deployment credentials, if added later, belong only in GitHub secret storage;
- `.env.example` contains names/placeholders only;
- the real `server/.env` must stay outside `server/public/` and outside Git.
