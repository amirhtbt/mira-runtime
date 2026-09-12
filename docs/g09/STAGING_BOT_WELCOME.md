# Staging bot welcome

- Only the approved staging bot (`invoice_app_staging_bot`) and `https://invoice-staging.box4u.co` are in scope. Production bot and origin must remain unchanged.
- `/start` in a private chat receives a short Persian welcome and a single inline Mini App button. Other messages and group chats receive no response. The existing BotFather profile and persistent menu button are unchanged.
- `bot-webhook.php` accepts Telegram POST updates only when the `X-Telegram-Bot-Api-Secret-Token` header matches a staging-only HMAC derived from `SESSION_PEPPER`. No bot token or customer data is logged by this endpoint.
- The staging deploy workflow checks the endpoint rejects unauthenticated POSTs, refuses to overwrite a different webhook URL, sets the Telegram webhook without dropping queued updates, and confirms the configured URL only after smoke tests pass. Subsequent staging deployments recheck this configuration.
- Acceptance: open the staging bot in a private Telegram chat, send `/start`, confirm the Persian welcome and that its button opens the existing Mini App. Sending unrelated text should not trigger this welcome. Existing `ساخت فاکتور` menu button must continue to work.
