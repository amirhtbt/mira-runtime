# Hosting & Deployment Requirements — V1

## Deployment goal

Run the Telegram Mini App core on a low-cost shared hosting plan in Iran, while keeping the application portable to VPS/cloud later.

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
- writable non-public application storage
- cron jobs
- daily backup or reliable backup mechanism
- configurable PHP upload/post limits

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

## Domain structure

V1 has no public website.

Suggested:
- `app.<domain>` = Telegram Mini App frontend + API
- optional `staging.<domain>` = test environment

The root domain can remain blank/redirected/reserved until a future website is justified.

## Telegram network dependency policy

The invoice creation path must not depend on outbound Bot API calls.

Main Mini App launch/authentication works through Telegram client-provided launch data plus the hosted app URL. If reliable server-to-Telegram Bot API communication is needed later for proactive notifications or bot replies, place it behind a replaceable integration/relay boundary.

## Shared-hosting constraints

Avoid V1 dependencies on:
- permanent Node.js server process
- Redis requirement
- long-running workers
- Docker requirement
- websocket requirement
- shell daemon

Use:
- static compiled frontend
- PHP request/response API
- database-backed jobs if needed
- cron-driven maintenance/background work

## Deployment model

Recommended:
1. Build frontend in CI.
2. Run automated tests.
3. Produce deploy artifact containing static client + PHP server code/dependencies.
4. Deploy only when gate tests pass.
5. Run migration in controlled step.
6. Health check.
7. Roll back artifact/database migration when acceptance fails.

Never edit production source manually as the normal workflow.

## Secrets

Host/server environment only:
- Telegram bot token if/when server Bot API integration exists
- application encryption/session secret
- database credentials
- any future third-party API credentials

Never commit secrets to GitHub or expose them in frontend bundles.
