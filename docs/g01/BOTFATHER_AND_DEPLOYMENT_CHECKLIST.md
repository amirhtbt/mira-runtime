# G01 BotFather + Hetzner Deployment Checklist

This is the human-action checklist for G01. Do not put tokens in GitHub issues, screenshots, frontend code or chat logs.

## 0. Confirm the existing Hetzner package

Before deployment, read the actual account values in Hetzner/konsoleH and record only non-secret facts:
- package/product name
- PHP version selectable to 8.2+
- PHP memory limit (must be >=256 MB for current V1 baseline)
- SSH available or not
- MariaDB/MySQL database available
- cron available
- domain/subdomain document-root configuration available
- HTTPS certificate active

If the package has only 192 MB PHP memory (equivalent to the current Webhosting S limit), it is below the frozen V1 baseline. Current M is the minimum memory match; L is preferred because it includes SSH and more PHP memory.

## 1. Environment split

Use two separate environments on Hetzner:

### Production
- HTTPS origin: `https://app.<chosen-domain>`
- production database
- production application/session secret
- production Telegram bot token
- Main Mini App URL points directly to the production origin

### Staging
- HTTPS origin: `https://staging.<chosen-domain>`
- separate staging database
- separate application/session secret
- preferably a separate staging/test bot and bot token
- Main Mini App/direct Mini App URL points directly to the staging origin

Do not redirect an already-open Mini App between staging and production origins. Telegram origin protection is active in 2026.

## 2. Deploy the CI artifact to Hetzner staging

Use the G01 shared-host artifact produced for the accepted commit.

After extraction, configure the staging subdomain's **Document Root** to the extracted:

`server/public/`

This is important: do not point the public domain at the release root or `server/` directory.

The public directory contains only:
- compiled frontend assets
- `index.php` API front controller
- `.htaccess` routing/security policy

Application source, migration files and the real `.env` remain outside the document root.

## 3. Runtime configuration

Create the real file:

`server/.env`

from `.env.example` and set server-side values only:
- `APP_ENV`
- `APP_ORIGIN`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_PEPPER`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- auth/session TTL variables

Never upload the real `.env` to GitHub.

For staging, `APP_ORIGIN` must exactly equal the staging HTTPS origin, with no unrelated domain or wildcard.

## 4. Database migration

If the Hetzner account has SSH:

- run the release's `server/bin/migrate.php` with the configured PHP 8.2+ CLI.

If SSH is unavailable:

- use Hetzner phpMyAdmin to apply the versioned SQL from `server/migrations/001_g01_foundation.sql` to the staging database;
- do not expose a temporary public migration endpoint just to avoid this manual step.

## 5. BotFather — staging first

1. Create/select the staging/test bot in `@BotFather` where practical.
2. Open Bot Settings and configure **Main Mini App**.
3. Set the Mini App URL to the exact staging HTTPS origin.
4. Keep the bot token only in `server/.env` on staging.
5. Record the bot username and configured origin in GitHub evidence; never record the token.

Only after G01 acceptance should the production bot/origin be configured for promotion.

## 6. Deployment smoke checks

Before device acceptance:

1. `GET /api/v1/health` returns HTTP 200.
2. Frontend static files load over HTTPS with no mixed content.
3. A direct invalid/unsigned call to `POST /api/v1/auth/telegram` cannot authenticate.
4. No token/secret is visible in page source, JS assets or network responses.
5. Session cookie is `HttpOnly` and `Secure` in staging/production.
6. Staging credentials cannot authenticate against production data.
7. Reloading a valid session works without reusing raw `initData` as a long-lived API token.
8. Session renewal does not extend the original absolute session lifetime.

## 7. Manual Telegram acceptance matrix

Record PASS/FAIL for:

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

Also test at least once from an Iranian user network or a representative full-device VPN/proxy path used by the target audience. German hosting removes the server-side Iran restriction but does not eliminate client-network filtering.

G01 cannot PASS until the required real-device checks are recorded.
