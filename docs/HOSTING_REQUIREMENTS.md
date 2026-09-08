# Hosting & Deployment Requirements — V1

## Deployment goal

Primary V1 deployment target is the owner's existing **Hetzner shared hosting in Germany**. The application must remain portable to other conventional PHP/MySQL shared hosts and to a VPS/cloud later.

This supersedes the earlier assumption that production itself would be hosted inside Iran. It does **not** reopen G00 architecture: the selected PHP/MySQL/static-client design remains valid and becomes less constrained by server-side Telegram filtering.

The authoritative invoice path must still remain functional without server-to-Telegram Bot API connectivity.

## Required host capabilities

Mandatory:
- custom domain/subdomain
- valid HTTPS certificate
- PHP 8.2 or newer
- MySQL 8 / MariaDB equivalent
- at least 256 MB PHP memory limit; 512 MB preferred
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
- Apache `mod_rewrite` or equivalent routing for the G01 shared-host artifact

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

## Hetzner compatibility decision — 2026-09-08

Official Hetzner documentation currently confirms selectable PHP 8.x versions, MariaDB/MySQL-compatible databases, cron jobs, `mod_rewrite`, daily-backup-oriented hosting features and PHP extensions relevant to this project. Current Webhosting package limits differ by plan.

For the currently advertised S/M/L/XL family:
- S: 192 MB PHP memory; below this project's current 256 MB minimum.
- M: 256 MB PHP memory; meets the minimum but does not include interactive SSH.
- L: 384 MB PHP memory and SSH; recommended practical baseline for this project.
- XL: 512 MB PHP memory and SSH; ample for V1 and later export stress testing.

The owner's exact existing Hetzner package must be verified before staging deployment. If it is an older Hetzner product rather than the current S/M/L/XL family, use the actual account limits instead of inferring them from current marketing names.

Node.js/Redis support on larger Hetzner plans is not required by V1. Production remains a static frontend + PHP request/response API.

## Capacity starting point

For a pilot, target roughly:
- 2–5 GB or more available storage
- enough DB quota for hundreds of thousands of lightweight records
- >=256 MB PHP per-script memory
- at least several concurrent PHP processes for pilot traffic
- cron capability
- reliable daily backups retained several days

Before production acceptance, record the exact selected account limits for:
- package/product name
- PHP version and memory limit
- concurrent PHP workers/processes
- max execution time
- upload/post size
- DB quota/connections
- cron count/frequency
- SSH availability
- backup retention/restore
- outbound HTTPS behavior

## Domain and environment structure

V1 has no public marketing website.

Recommended:
- `app.<domain>` = production Telegram Mini App frontend + API
- `staging.<domain>` = staging/test environment

The root domain can remain unused/reserved until a future website is justified.

Production and staging are separate security boundaries:
- separate databases
- separate application/session secrets
- separate Telegram bot token/configuration where practical
- no production credential in staging CI/runtime
- no staging data promoted into production as an authentication source

Telegram's Mini App origin hardening is active in 2026. Frontend + API therefore remain same-origin in V1 and the app must not navigate between staging and production origins while expecting Telegram-native methods to continue working.

## Iranian-user network policy

Although the server is in Germany, the pilot audience may connect from Iran where Telegram and ordinary HTTPS connectivity can be filtered or routed through VPN/proxy paths.

Architecture rules remain:
- invoice create/calculate/save/finalize/export never requires a synchronous Bot API call;
- Telegram launch authentication uses client-provided `initData` plus local cryptographic verification and does not require a server round-trip to Telegram;
- proactive Bot API messaging remains an optional adapter;
- a Telegram/Bot API outage must not corrupt an invoice operation.

Production acceptance must still test:
- Mini App HTTPS reachability from an Iranian network;
- common full-device VPN/proxy paths used by the pilot audience;
- DNS/TLS consistency;
- actual outbound Bot API behavior from the selected Hetzner account rather than assuming it.

A Telegram MTProto proxy and the Mini App WebView's normal HTTPS traffic are separate paths; one must not be assumed to proxy the other.

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

## G01 Hetzner artifact layout

G01 CI produces an immutable shared-host archive. After extraction, use:

- `server/public/` as the subdomain's **Document Root**
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

V1 must not require a server-side browser renderer. G06 must prove its Persian image/PDF export path against the documented performance and visual fixtures on production-like Hetzner hosting.

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
