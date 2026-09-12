# Owner analytics (staging)

This is an opt-in, read-only, cross-tenant aggregate dashboard, not a tenant-facing customer directory. The endpoint `GET /api/v1/owner/summary` requires an authenticated Telegram Mini App session and an exact match between the session user's persisted Telegram ID and `OWNER_TELEGRAM_USER_ID`. A missing or invalid ID denies everyone. Other users receive 404. No customer names, phone numbers, document bodies or raw Telegram IDs are returned.

## Enable

1. Find your numeric Telegram account ID (not username or bot ID). Keep it private.
2. In `amirhtbt/mira-runtime` → Settings → Secrets and variables → Actions, create `STAGING_OWNER_TELEGRAM_USER_ID` with your numeric ID. It is copied into staging's protected runtime env on the next staging deployment. Production is not configured by this workflow.
3. Run the staging deployment workflow after the PR has passed CI and is merged, or wait for its automatic `deploy/staging` run. Confirm the exact SHA's deployment and post-deploy smoke succeed.
4. In the **staging bot's private chat** on that same account, send `/stats` and tap «نمایش آمار برنامه». This launches the Mini App with authenticated Telegram initData. A direct link in an ordinary browser is insufficient. The `/stats` reply itself is restricted to the configured ID, and the API independently checks the persisted authenticated identity.

Counts are all registered app users, distinct 30-day app-open users, customer rows, issued invoice/proforma counts, explicit conversions, issued gross amounts independently in rial, and confirmed proforma payment sum in rial. Do not add proforma gross to invoice gross (conversion double-count). Direct-invoice full settlement is not a separately recorded payment entry. No data export or personal-data access is included.

This dashboard is safe to deploy while the secret is unset: it remains inaccessible. Do not accept authorization by a request header, guessed URL, Telegram username or database business ID.
