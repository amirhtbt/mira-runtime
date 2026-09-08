# G01 Shataban Host deployment evidence — 2026-09-08

Gate: G01 / Issue #2

## Owner-confirmed hosting target

The V1 Telegram Mini App will use the owner's existing **Shataban Host shared hosting in Germany**. The same hosting account currently serves `box4u.co`.

This supersedes the earlier Hetzner assumption. It does not reopen G00 architecture because the application remains a static frontend + PHP/MySQL shared-host deployment.

## Known account resources

From the owner-provided hosting-plan and cPanel screenshots:

- hosting package: `CP-01`
- location: Germany
- storage quota: approximately 9 GB total after purchased storage extension
- current disk use: 6.86 GB / 9 GB (76.24%)
- current free space at evidence time: approximately 2.14 GB
- CPU allocation shown by the plan: 2 GHz dedicated CPU
- RAM allocation: 2 GB dedicated RAM
- current physical memory use at evidence time: 9.27 MB / 2 GB
- monthly traffic: unlimited
- storage type: NVMe
- backups: daily / weekly
- cPanel: 136.0 build 38
- Apache: 2.4.68
- database server: MariaDB 10.6.28
- operating system: Linux x86_64
- entry-process limit: 30; observed use 1 / 30
- process limit: 100; observed use 1 / 100
- database disk quota: 2.16 GB; observed use 21.72 MB
- subdomains: unlimited; observed 3 in use
- addon domains: 0 / 0

## Compatibility decision

The confirmed Apache/MariaDB/Linux stack is compatible with the frozen G01 architecture. The account-level 2 GB RAM, 30 entry-process limit and 100 process limit are sufficient for G01 staging and a modest validation pilot, subject to the still-unconfirmed per-PHP-process limits.

The account cannot add an ordinary addon domain under the current package (`0 / 0`). Therefore G01 staging should use a dedicated **subdomain** on an already-hosted domain, with a completely separate Document Root and database. A later independent production domain would require either a hosting/package capability change or another hosting target; this is not a blocker for G01 staging.

The current ~2.14 GB free disk is sufficient for G01 because the foundation artifact is small and G01 does not retain production invoice export volume. It is a capacity warning for later gates, especially G06 image/PDF exports and pilot retention. Disk growth must be re-reviewed before G06/G08 and generated export retention must not be designed as unlimited local storage.

## Co-hosting rule with Box4U

The Telegram Invoice Mini App must not be deployed inside the Box4U WordPress document root or database.

Required isolation on the same account:

- dedicated subdomain/origin for the Mini App
- separate Document Root pointing only to the Mini App release `server/public/`
- separate MySQL/MariaDB database and DB user where the panel permits it
- separate application/session secret
- separate Telegram bot token/configuration
- no shared WordPress tables, wp-config secrets or application files
- independent backup/restore path where the panel supports per-database/per-directory restore

Physical-account isolation is weaker than separate hosting accounts, but it is acceptable for G01/pilot if these application/data boundaries are enforced and resource contention is measured. A later production-hardening gate may move the app if Box4U load or account-level blast radius becomes material.

## Still required before staging deploy

The screenshots do not yet prove these runtime capabilities. Confirm from cPanel before G01 device acceptance:

- PHP 8.2+ selectable for the Mini App subdomain
- PHP `memory_limit` (project baseline >= 256 MB)
- PDO MySQL, mbstring, OpenSSL, fileinfo and cURL
- MySQL/MariaDB database creation and separate credentials
- Apache `mod_rewrite` / `.htaccess` support or equivalent routing
- HTTPS certificate for the chosen staging subdomain
- cron capability
- PHP `max_execution_time`, `upload_max_filesize`, `post_max_size`
- SSH availability (helpful, not mandatory for G01)
- access to PHP error logs

The cPanel process limits are now confirmed, so they are no longer an open item.

## Network decision

German hosting materially reduces the risk that the server itself cannot reach Telegram infrastructure. The core invoice path still remains independent of synchronous Bot API calls by architecture.

Client-side reachability for Iranian users must still be tested because a Telegram proxy and Mini App WebView HTTPS traffic are not necessarily the same network path.

## Current decision

No hosting blocker is identified for G01 staging from CPU, RAM, process limits, Apache, MariaDB, subdomain capability or location. The next gating fact is PHP runtime compatibility. After PHP is confirmed, create a dedicated staging subdomain rather than an addon domain.
