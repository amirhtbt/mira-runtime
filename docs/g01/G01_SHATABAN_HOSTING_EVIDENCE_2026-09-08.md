# G01 Shataban Host deployment evidence — 2026-09-08

Gate: G01 / Issue #2

## Owner-confirmed hosting target

The V1 Telegram Mini App will use the owner's existing **Shataban Host shared hosting in Germany**. The same hosting account currently serves `box4u.co`.

This supersedes the earlier Hetzner assumption. It does not reopen G00 architecture because the application remains a static frontend + PHP/MySQL shared-host deployment.

## Confirmed account resources

From the owner-provided hosting-plan and cPanel screenshots:

- hosting package: `CP-01`
- location: Germany
- storage quota: approximately 9 GB total after purchased storage extension
- current disk use at evidence time: 6.86 GB / 9 GB (76.24%)
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

## Confirmed PHP runtime

Owner-provided cPanel PHP Selector / MultiPHP evidence confirms:

- PHP 8.2 is available in the account selector;
- current Box4U domains use older PHP versions and must **not** be modified as part of G01;
- the Mini App staging subdomain will receive its own PHP 8.2 assignment;
- `memory_limit = 1024M`;
- `max_execution_time = 300` seconds;
- `post_max_size = 512M`;
- `upload_max_filesize = 512M`;
- `display_errors` is disabled;
- `log_errors` is enabled;
- file uploads are enabled;
- required G01 extensions are available/enabled, including `curl`, `fileinfo`, `json`, `mbstring`, `openssl`, `PDO`, and `pdo_mysql`.

These values exceed the frozen G01 minimums. No PHP-runtime blocker remains for staging.

`Imagick` is not required by G01 and remains a later export-path concern. G06 must re-evaluate image/PDF rendering capability and disk consumption rather than assuming current G01 hosting evidence is sufficient for export scale.

## Compatibility decision

The confirmed Apache/MariaDB/Linux/PHP stack is compatible with the frozen G01 architecture. The account-level 2 GB RAM, 30 entry-process limit, 100 process limit and PHP 1024M memory ceiling are sufficient for G01 staging and a modest validation pilot.

The account cannot add an ordinary addon domain under the current package (`0 / 0`). Therefore G01 staging will use a dedicated **subdomain** on an already-hosted domain, with a completely separate Document Root and database. A later independent production domain would require either a hosting/package capability change or another hosting target; this is not a blocker for G01 staging.

The current ~2.14 GB free disk is sufficient for G01. It is a capacity warning for later gates, especially G06 image/PDF exports and pilot retention. Disk growth must be re-reviewed before G06/G08 and generated-export retention must not be designed as unlimited local storage.

## Co-hosting rule with Box4U

The Telegram Invoice Mini App must not be deployed inside the Box4U WordPress document root or database.

Required isolation on the same account:

- dedicated subdomain/origin for the Mini App;
- separate Document Root pointing only to the Mini App release `server/public/`;
- separate MySQL/MariaDB database and DB user;
- separate application/session secret;
- separate Telegram bot token/configuration;
- no shared WordPress tables, `wp-config.php` secrets or application files;
- dedicated deployment credential jailed to the Mini App staging root;
- independent backup/restore path where the panel supports per-database/per-directory restore.

Physical-account isolation is weaker than separate hosting accounts, but it is acceptable for G01/pilot if these application/data boundaries are enforced and resource contention is measured. A later production-hardening gate may move the app if Box4U load or account-level blast radius becomes material.

## Deployment decision — no routine GitHub artifacts

Owner decision: routine deployments should avoid GitHub Actions artifact retention.

G01 deployment therefore uses:

1. normal GitHub CI/security tests;
2. a dedicated `deploy/staging` Git ref as the staging release pointer;
3. a deployment workflow that rebuilds and tests the selected commit inside the GitHub runner;
4. release preparation in ephemeral runner storage only;
5. direct FTPS deployment to a cPanel FTP account jailed to the staging app root;
6. temporary pre-deploy backup inside the same ephemeral runner;
7. post-deploy HTTPS health smoke test;
8. automatic file rollback during the same run if upload or smoke validation fails.

No deploy archive is uploaded to GitHub in the normal path. `scripts/package-shared-host.sh` remains only as an emergency/manual packaging utility; the routine artifact-upload workflow is removed.

This is a G01 staging deployment strategy. Stronger atomic promotion/rollback requirements for production are still owned by G08 and must not be assumed solved solely by FTPS staging deployment.

## Remaining host-side checks before real Telegram acceptance

Runtime compatibility is now confirmed. Remaining staging setup facts/actions are operational rather than architectural:

- create the dedicated staging subdomain and exact Document Root;
- ensure PHP 8.2 is assigned only to that new subdomain;
- confirm HTTPS/AutoSSL on the staging origin;
- create a dedicated staging DB + DB user;
- confirm `.htaccess` rewrite behavior with the deployed health route;
- confirm PHP error log access;
- create a dedicated FTP account whose root is the Mini App staging application root, never the cPanel account home or Box4U WordPress root;
- SSH availability remains optional for G01.

## Network decision

German hosting materially reduces the risk that the server itself cannot reach Telegram infrastructure. The core invoice path still remains independent of synchronous Bot API calls by architecture.

Client-side reachability for Iranian users must still be tested because a Telegram proxy and Mini App WebView HTTPS traffic are not necessarily the same network path.

## Current decision

No hosting blocker remains for G01 staging from CPU, RAM, PHP, process limits, Apache, MariaDB, subdomain capability or location. The next step is isolated staging provisioning and direct GitHub-to-cPanel deployment, followed by BotFather and real-device acceptance.
