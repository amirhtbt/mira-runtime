# Hosting & Deployment Requirements — V1

## Deployment goal

Run the Telegram Mini App core on a low-cost shared hosting plan in Iran, while keeping the application portable to VPS/cloud later.

The authoritative invoice path must remain functional without server-to-Telegram Bot API connectivity.

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

## Capacity starting point

For a pilot, choose a plan with roughly:
- 2–5 GB SSD/NVMe storage
- enough database quota for at least hundreds of thousands of lightweight records
- 1 GB+ effective burst memory where provider exposes it
- reasonable CPU fair-use policy
- daily backups retained several days

Do not choose the cheapest plan solely by storage size. PHP process limits, CPU throttling, DB connections and backup quality matter more.

Before buying/committing to a specific host, record the provider's actual limits for:
- concurrent PHP workers/processes
- max execution time
- PHP memory
- upload/post size
- DB size/connections
- cron frequency
- backup retention/restore
- outbound HTTPS policy
- geo/IP access restrictions

## Domain and environment structure

V1 has no public website.

Suggested:
- `app.<domain>` = production Telegram Mini App frontend + API
- `staging.<domain>` = staging/test environment

The root domain can remain blank/redirected/reserved until a future website is justified.

Production and staging are separate security boundaries:
- separate databases
- separate application/session secrets
- separate Telegram bot token/configuration where practical
- no production credential in staging CI/runtime
- no staging data promoted into production as an authentication source

Telegram's Mini App origin hardening is active in 2026. The active Mini App should therefore keep frontend + API same-origin in V1 and must not depend on cross-origin navigation for Telegram-native methods.

## Iran/Telegram network dependency policy

Telegram connectivity is filtered/interfered with on Iranian networks, and an Iran-based shared host may be unable to reach `api.telegram.org` reliably.

Architecture rule:
- invoice create/calculate/save/finalize/export must not depend on synchronous Bot API calls;
- Telegram launch authentication relies on client-provided `initData` plus local server verification, not a server round-trip to Telegram;
- proactive bot messaging/notifications are optional integrations and may later use a replaceable relay if the selected host cannot reach Telegram;
- a Bot API outage must never roll back or corrupt an otherwise valid invoice operation.

Host/network acceptance before production must verify:
- the app HTTPS origin is reachable from target Iranian user networks;
- the app still loads for users connected through common full-device VPN/proxy paths;
- the hosting provider does not geo-lock traffic in a way that breaks the pilot audience;
- DNS/TLS work consistently from inside and outside Iran;
- the exact selected host's outbound Bot API behavior is measured rather than assumed.

Because Telegram MTProto proxying and ordinary WebView HTTPS traffic are different network paths, do not assume that a Telegram proxy automatically proxies requests from the Mini App WebView.

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

## Frontend build/deployment

Recommended:
1. Build TypeScript/React frontend in CI, not on production shared hosting.
2. Run lint/type/unit/security tests.
3. Produce immutable static frontend assets with hashed filenames.
4. Package PHP server code plus vetted Composer dependencies.
5. Produce one deploy artifact traceable to commit SHA.
6. Deploy artifact to staging/production.
7. Run controlled schema migration.
8. Run health/smoke check.
9. Roll back artifact/database migration when acceptance fails.

Never edit production source manually as the normal workflow.

## Files and exports

Host must support safe application storage for logos and generated exports where server-side persistence is used.

V1 must not require a server-side browser renderer. G06 must prove its chosen Persian image/PDF export path against the documented performance and visual fixtures on production-like hosting.

## Secrets

Host/server environment only:
- Telegram bot token
- application encryption/session secret
- database credentials
- any future third-party API credentials

Rules:
- never commit secrets to GitHub;
- never expose secrets in frontend bundles;
- staging and production use distinct secrets;
- CI may consume deployment secrets only through the repository/platform secret store, never checked-in `.env` files;
- `.env.example` may contain names/placeholders only, never real values.
