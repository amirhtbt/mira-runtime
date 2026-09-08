# G01 Shataban Host deployment evidence — 2026-09-08

Gate: G01 / Issue #2

## Owner-confirmed hosting target

The V1 Telegram Mini App will use the owner's existing **Shataban Host shared hosting in Germany**. The same hosting account currently serves `box4u.co`.

This supersedes the earlier Hetzner assumption. It does not reopen G00 architecture because the application remains a static frontend + PHP/MySQL shared-host deployment.

## Known account resources

From the owner-provided hosting-plan screenshot:

- location: Germany
- storage: 1 GB base plan + 8 GB purchased extra = approximately 9 GB total account storage
- CPU allocation shown by the owner's plan: 2 GHz dedicated CPU
- RAM allocation: 2 GB dedicated RAM
- monthly traffic: unlimited
- storage type: NVMe
- backups: daily / weekly

These resources are adequate for G01 staging and are reasonable for the initial V1 pilot, subject to the runtime limits below and the fact that `box4u.co` shares the same hosting account/resources.

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

The screenshot does not prove the following runtime capabilities. Confirm from the hosting control panel before G01 device acceptance:

- PHP 8.2+ selectable for the Mini App subdomain
- PHP `memory_limit` (project baseline >= 256 MB)
- PDO MySQL, mbstring, OpenSSL, fileinfo and cURL
- MySQL/MariaDB database creation and separate credentials
- Apache `mod_rewrite` / `.htaccess` support or equivalent routing
- HTTPS certificate for the chosen staging subdomain
- cron capability
- PHP `max_execution_time`, `upload_max_filesize`, `post_max_size`
- SSH availability (helpful, not mandatory for G01)
- concurrent PHP/process limits if exposed by the provider
- access to PHP error logs

## Network decision

German hosting materially reduces the risk that the server itself cannot reach Telegram infrastructure. The core invoice path still remains independent of synchronous Bot API calls by architecture.

Client-side reachability for Iranian users must still be tested because a Telegram proxy and Mini App WebView HTTPS traffic are not necessarily the same network path.

## Current decision

No hosting blocker is identified from CPU/RAM/storage/location. G01 may proceed to a staging subdomain once the runtime capability checklist above is confirmed.
