# G01 BotFather + Shataban Deployment Checklist

This is the human-action checklist for G01. Do not put tokens, DB passwords or application secrets in GitHub issues, screenshots, frontend code or chat logs.

## 0. Confirm the existing Shataban account runtime

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
- `box4u.co` already runs on the same hosting account

Still confirm before deployment:
- PHP 8.2+ selectable for the Mini App subdomain
- PHP `memory_limit` >= 256 MB
- PDO MySQL, mbstring, OpenSSL, fileinfo and cURL enabled
- MySQL/MariaDB database + separate DB user can be created
- cron available
- custom subdomain Document Root can point to the release `server/public/`
- `.htaccess` / rewrite support works
- HTTPS certificate active for the staging subdomain
- PHP error logs accessible
- SSH availability (optional for G01)
- PHP `max_execution_time`, `upload_max_filesize`, `post_max_size`

## 1. Isolation from Box4U

Even though both products share the hosting account, do **not** deploy the Mini App into the Box4U WordPress tree or DB.

Required:
- dedicated Mini App subdomain/origin
- dedicated Document Root
- dedicated DB and preferably dedicated DB user
- dedicated `server/.env`
- dedicated Telegram bot token/configuration
- no reuse of WordPress tables or `wp-config.php` secrets

Because addon domains are unavailable on this package, **G01 staging uses a subdomain of an already-hosted domain**. This is a staging constraint, not a product-identity decision. Do not bind future paid/web identity or internal user IDs to the Box4U domain.

## 2. Environment split

### Production
- production origin remains a future deployment choice after G01/pilot acceptance
- production DB, secrets and Telegram bot are separate from staging

### Staging
- dedicated HTTPS subdomain on the current Shataban account
- separate staging DB
- separate application/session secret
- preferably separate staging/test bot and token

Do not redirect an already-open Mini App between staging and production origins. Telegram origin protection is active in 2026.

## 3. Deploy the CI artifact to Shataban staging

Use the G01 shared-host artifact produced for the accepted commit.

After extraction, configure the staging subdomain's **Document Root** to:

`server/public/`

Do not point the public domain at the release root or the `server/` directory.

The public directory contains only compiled frontend assets, `index.php` API front controller and `.htaccess` routing/security policy. Application source, migration files and the real `.env` stay outside the public document root.

## 4. Runtime configuration

Create `server/.env` from `.env.example`, setting server-side values only:
- `APP_ENV`
- `APP_ORIGIN`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_PEPPER`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- auth/session TTL variables

For staging, `APP_ORIGIN` must exactly equal the staging HTTPS origin.

## 5. Database migration

If SSH/CLI is available:
- run `server/bin/migrate.php` using PHP 8.2+ CLI.

If SSH is unavailable:
- use the hosting panel/phpMyAdmin to apply `server/migrations/001_g01_foundation.sql` to the dedicated staging database;
- do not expose a temporary public migration endpoint.

## 6. BotFather — staging first

1. Create/select a staging/test bot in `@BotFather` where practical.
2. Configure **Main Mini App**.
3. Set its URL to the exact staging HTTPS origin.
4. Keep the bot token only in `server/.env` on staging.
5. Record only the bot username and configured origin as evidence; never the token.

## 7. Deployment smoke checks

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

## 8. Manual Telegram acceptance matrix

| Check | Android | iOS | Desktop |
|---|---|---|---|
| Main Mini App launches | ☐ | ☐ | ☐ |
| Secure auth succeeds | ☐ | ☐ | ☐ |
| Relaunch reuses valid app session | ☐ | ☐ | ☐ |
| Light theme | ☐ | ☐ | ☐ |
| Dark theme | ☐ | ☐ | ☐ |
| Safe area respected | ☐ | ☐ | ☐ |
| Content safe area respected | ☐ | ☐ | ☐ |
| Viewport/keyboard does not break shell | ☐ | ☐ | ☐ |
| Back button foundation works | ☐ | ☐ | ☐ |
| Haptic fallback causes no error | ☐ | ☐ | ☐ |

Also test at least once from an Iranian user network or a representative full-device VPN/proxy path used by the target audience.

G01 cannot PASS until the required real-device checks are recorded.
