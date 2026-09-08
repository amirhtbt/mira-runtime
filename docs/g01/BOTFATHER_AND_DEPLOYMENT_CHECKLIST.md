# G01 BotFather + Deployment Checklist

This is the human-action checklist for G01. Do not put tokens in GitHub issues, screenshots, frontend code or chat logs.

## Environment split

Use two separate environments:

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

Do not redirect an already-open Mini App between staging and production origins. Telegram's origin protection is active in 2026.

## BotFather steps — production

1. Create/select the production bot in `@BotFather`.
2. Open bot settings and configure **Main Mini App**.
3. Set the Mini App URL to the exact production HTTPS origin.
4. Keep the bot token only in the production server secret/environment configuration.
5. Do not enable any Bot API-dependent feature as a prerequisite for invoice creation.
6. Record the bot username and configured origin in deployment evidence; never record the token.

## BotFather steps — staging

Repeat with a separate staging/test bot where practical.

## Shared-host runtime variables

Configure server-side only:
- `APP_ENV`
- `APP_ORIGIN`
- `TELEGRAM_BOT_TOKEN`
- `SESSION_PEPPER`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- auth/session TTL variables from `.env.example`

## Deployment smoke checks

Before device acceptance:

1. `GET /api/v1/health` returns HTTP 200.
2. Frontend static files load over HTTPS with no mixed content.
3. `POST /api/v1/auth/telegram` is not callable successfully without a valid signed Telegram `initData`.
4. No token/secret is visible in page source, JS assets or network responses.
5. Session cookie is `HttpOnly` and `Secure` in staging/production.
6. Staging credentials cannot authenticate against production data.

## Manual Telegram acceptance matrix

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

G01 cannot PASS until the required real-device checks are recorded.
