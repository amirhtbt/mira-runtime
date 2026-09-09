# G01 BotFather + Shataban Deployment Checklist

This is the human-action checklist for G01. Do not put tokens, DB passwords or application secrets in GitHub issues, screenshots, frontend code or chat logs.

## 0. Confirmed Shataban runtime

Confirmed owner evidence:
- Germany location
- package `CP-01`
- ~9 GB storage quota; 6.86 GB used / ~2.14 GB free at evidence time
- 2 GHz dedicated CPU allocation shown by plan
- 2 GB account RAM
- entry-process limit 30
- process limit 100
- MariaDB 10.6.28 with 2.16 GB DB quota
- Apache 2.4.68 on Linux x86_64
- unlimited subdomains
- addon domains unavailable (`0 / 0`)
- NVMe, unlimited traffic, daily/weekly backups
- PHP 8.2 available
- `memory_limit=1024M`
- `max_execution_time=300`
- `post_max_size=512M`
- `upload_max_filesize=512M`
- `curl`, `fileinfo`, `json`, `mbstring`, `openssl`, `PDO`, `pdo_mysql` available
- `box4u.co` already runs on the same hosting account

No PHP compatibility blocker remains for G01.

## 1. Isolation from Box4U

Even though both products share the hosting account, do **not** deploy the Mini App into the Box4U WordPress tree or DB.

Required:
- dedicated Mini App staging subdomain/origin
- dedicated Document Root ending at the Mini App `server/public/`
- dedicated DB and DB user
- dedicated `server/.env`
- dedicated Telegram staging/test bot token/configuration
- no reuse of WordPress tables or `wp-config.php` secrets
- dedicated FTP account jailed to the Mini App staging application root only

Because addon domains are unavailable on this package, **G01 staging uses a subdomain of an already-hosted domain**. This is only a staging constraint and must not become product/domain identity.

Recommended G01 staging origin unless a later owner decision changes it:

`https://invoice-staging.box4u.co`

Recommended application root in cPanel home:

`invoice-staging/`

Recommended subdomain Document Root:

`invoice-staging/server/public/`

The exact cPanel UI path may display the account home prefix automatically; do not place this directory under the existing Box4U WordPress document root.

## 2. PHP assignment

After creating the staging subdomain:

1. open MultiPHP Manager;
2. select only the new staging subdomain;
3. assign PHP 8.2;
4. do not change `box4u.co`, `box.box4u.co`, `giftbox.box4u.co` or `shapebox.box4u.co` as part of this gate.

## 3. Dedicated staging DB

Create a separate MariaDB database and DB user for the Mini App staging environment. Grant that user privileges only on the staging database.

Do not reuse the Box4U WordPress database/user.

If SSH is unavailable, the initial G01 migration may be applied through phpMyAdmin using:

`server/migrations/001_g01_foundation.sql`

Do not create a public migration endpoint.

## 4. GitHub → cPanel direct deployment

Routine GitHub artifacts are disabled for the deployment path.

The repository contains:
- `.github/workflows/g01-deploy-staging.yml`
- `scripts/prepare-shared-host-release.sh`
- `scripts/deploy-ftps.sh`

Deployment trigger:
- the exact commit pointed to by branch/ref `deploy/staging` is the staging release candidate;
- moving/creating that ref triggers build + security/integration tests + direct FTPS deployment;
- no normal GitHub deploy artifact is retained.

Before enabling the ref, create a **dedicated cPanel FTP account** whose home/root is exactly the Mini App staging application root (`invoice-staging/`). The FTP account must not be rooted at the cPanel account home, `public_html`, or any Box4U WordPress directory.

The workflow always treats remote `./` as the isolated Mini App staging root. This is a hard safety assumption.

### GitHub repository Secrets required

The operational deploy workflow uses these repository Actions secret names:

- `STAGING_FTPS_HOST`
- `STAGING_FTPS_USER`
- `STAGING_FTPS_PASSWORD`
- `STAGING_ORIGIN`
- `STAGING_TELEGRAM_BOT_TOKEN`
- `STAGING_SESSION_PEPPER`
- `STAGING_DB_NAME`
- `STAGING_DB_USER`
- `STAGING_DB_PASSWORD`

For the proposed staging URL, `STAGING_ORIGIN` is:

`https://invoice-staging.box4u.co`

Do not paste FTP password or other secret values into chat/issues/screenshots.

Use the cPanel-recommended FTP hostname that presents a valid TLS certificate. The workflow keeps FTPS certificate verification enabled and must not be weakened to accept a bad/self-signed/mismatched certificate.

## 5. Direct-deploy rollback behavior

Before each staging upload, the workflow mirrors the current isolated staging tree into ephemeral GitHub runner storage.

It then:
1. deploys the newly built release directly over encrypted FTPS;
2. preserves `server/.env` rather than deleting/replacing it;
3. calls `${STAGING_ORIGIN}/api/v1/health`;
4. automatically restores the previous file tree in the same run if the upload or smoke check fails.

The backup is not uploaded as a GitHub artifact and disappears with the runner.

This is adequate for G01 staging only. Production-grade atomic promotion and DB rollback remain G08 scope.

## 6. Runtime configuration

Create `server/.env` from `.env.example` on the staging application root and set server-side values only:
- `APP_ENV=staging`
- `APP_ORIGIN=https://invoice-staging.box4u.co` (or the exact accepted staging origin)
- `TELEGRAM_BOT_TOKEN`
- `SESSION_PEPPER`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- auth/session TTL variables

Never commit or upload the real `.env` to GitHub. The deploy workflow explicitly preserves the remote file.

## 7. BotFather — staging first

1. Create/select a staging/test bot in `@BotFather` where practical.
2. Configure **Main Mini App**.
3. Set its URL to the exact staging HTTPS origin.
4. Keep the bot token only in `server/.env` on staging.
5. Record only the bot username and configured origin as evidence; never the token.

## 8. Deployment smoke checks

Before device acceptance:
1. `GET /api/v1/health` returns HTTP 200.
2. Frontend static files load over HTTPS with no mixed content.
3. Invalid/unsigned `POST /api/v1/auth/telegram` cannot authenticate.
4. No token/secret appears in page source, JS assets or API responses.
5. Session cookie is `HttpOnly` and `Secure`.
6. Reloading a valid session works without treating raw `initData` as a long-lived API token.
7. Session renewal does not extend the original absolute session lifetime.
8. Box4U remains healthy after staging deployment and there is no shared-path/DB collision.
9. Disk use remains safely below account quota after staging deploy.

## 9. Manual Telegram acceptance matrix

| Check | Android | iOS | Desktop |
|---|---|---|---|
| Main Mini App launches | PASS | DEFERRED to G08 | PASS |
| Secure auth succeeds | PASS | DEFERRED to G08 | PASS |
| Relaunch reuses valid app session | PASS | DEFERRED to G08 | PASS |
| Light theme | PASS | DEFERRED to G08 | PASS |
| Dark theme | PASS | DEFERRED to G08 | PASS |
| Safe area respected | PASS | DEFERRED to G08 | PASS |
| Content safe area respected | PASS | DEFERRED to G08 | PASS |
| Viewport/keyboard does not break shell | PASS | DEFERRED to G08 | PASS |
| Back button foundation works | PASS | DEFERRED to G08 | PASS |
| Haptic fallback causes no error | PASS | DEFERRED to G08 | PASS |

Also test at least once from an Iranian user network or a representative full-device VPN/proxy path used by the target audience.

G01 passed under the recorded owner scope decision. iOS is explicitly deferred, not passed, and remains mandatory in G08 before G09 pilot.
