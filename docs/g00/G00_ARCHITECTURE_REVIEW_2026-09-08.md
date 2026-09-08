# G00 Architecture Review — 2026-09-08

Repository: `amirhtbt/telegram-invoice-miniapp`
Reviewed main: `61f6f72f3b220153f77563180072152e9f2ddcba`
Gate: G00 / Issue #1

## Scope reviewed

- Telegram Mini App architecture
- Telegram `initData` validation and session boundary
- internal user identity and Telegram adapter boundary
- PHP 8.2+/MySQL shared-hosting compatibility
- Iran-hosted networking constraints
- frontend build/deployment
- database/multi-tenant readiness
- immutable invoice snapshots
- template versioning
- future web/paid migration
- file upload security
- PDF/image export feasibility
- RTL/Persian rendering
- performance/test strategy

## Official Telegram evidence checked

Reviewed current Telegram documentation on 2026-09-08:

- Mini Apps guide: https://core.telegram.org/bots/webapps
- Bot API / recent platform changes: https://core.telegram.org/bots/api
- Mini App MTProto/client overview: https://core.telegram.org/api/bots/webapps

Relevant current platform facts:

1. `Telegram.WebApp.initDataUnsafe` must not be trusted for authorization; raw `initData` must be validated server-side.
2. Token-based validation uses Telegram's documented HMAC-SHA-256 data-check-string algorithm. Telegram also documents Ed25519 validation for third parties that do not know the bot token; G01 does not need that alternative because the backend owns the bot token.
3. `auth_date` is explicitly provided so outdated launch data can be rejected. Telegram does not prescribe one universal TTL, so the application must define and test its own freshness/replay policy.
4. Safe-area/content-safe-area, viewport, theme, BackButton and HapticFeedback are first-class Mini App APIs and should remain isolated behind the Telegram client adapter.
5. Telegram hardened Mini Apps against invoking Mini App methods from origins other than the original Mini App domain; this protection became automatic on 2026-07-20. Production and staging therefore must not depend on cross-origin in-WebView navigation for Telegram-native behavior.

## Material findings and required G00 corrections

### F1 — Auth/session policy was directionally correct but underspecified

Severity: High if left ambiguous before G01.

The existing architecture correctly requires server-side `initData` validation, but it did not freeze parsing rules, freshness/replay behavior or the post-validation session boundary. G01 could otherwise produce a valid signature checker but still treat launch data as a reusable bearer credential.

Required correction:

- verify raw `initData` server-side before trusting any Telegram user field;
- use a strict query parser that rejects duplicate security-sensitive keys and avoids parser ambiguity;
- constant-time hash comparison;
- configurable short `auth_date` maximum age and clock-skew policy;
- exchange validated launch data for an opaque server-side session;
- never persist the bot token or session secret in the client;
- do not use raw `initData` as a long-lived API credential;
- define replay handling around a fingerprint of validated launch data plus short freshness window/session issuance semantics;
- keep authorization based on internal user/business IDs, not Telegram IDs supplied by the client.

### F2 — 2026 Telegram origin hardening requires explicit staging/production isolation

Severity: High if staging/prod are implemented as cross-origin redirects under one active Mini App session.

Required correction:

- production and staging are separate origins;
- use separate bot credentials/configuration for production and staging where practical;
- separate DB/session/application secrets;
- do not navigate the active Mini App WebView to another origin and expect Telegram-native methods to remain available;
- external destinations must use the Telegram/open-link adapter rather than replacing the app origin.

### F3 — Iran shared-hosting networking must not be part of the critical invoice path

Severity: Architectural blocker only if synchronous Bot API access were required. It is not required by the current design.

Iranian networks continue to interfere with Telegram connectivity. The application URL itself is loaded by the user's Telegram WebView as normal HTTPS, while server-to-`api.telegram.org` reachability from an Iran host can be unreliable/blocked. The existing architectural choice to keep invoice creation independent of synchronous Bot API calls is therefore correct and is now frozen as a G00 invariant.

Required host acceptance before production:

- app origin reachable over valid HTTPS from target user networks;
- no provider geo-lock that breaks users connected through VPN/proxy paths;
- PHP/MySQL limits meet documented baseline;
- outbound Telegram Bot API is treated as optional/untrusted unless proven on the selected host;
- any future relay is replaceable and outside the authoritative invoice transaction path.

### F4 — Immutable snapshot needed stronger version semantics

Severity: Medium.

Storing seller/customer/items/totals/settings/template version is correct, but future reproducibility also needs explicit snapshot/calculation metadata.

Required correction:

Finalized/exported snapshot stores at minimum:

- immutable snapshot schema version;
- seller/customer display data used;
- item rows plus authoritative precomputed line totals;
- adjustments and authoritative final totals;
- currency/base-unit and number/date presentation settings used;
- calculation/rounding policy version;
- template stable ID + immutable template version;
- created/finalized timestamps.

Historical output must never require recalculating totals using a newer engine.

### F5 — Upload policy should be narrower for V1

Severity: Medium security hardening.

V1 logo uploads should default to safe raster formats (PNG/JPEG/WebP after content validation). SVG is not accepted as a normal V1 logo upload because active/scriptable SVG content adds unnecessary risk. If SVG support is ever added, it requires sanitization/rasterization and dedicated tests.

### F6 — PDF/image export is feasible on shared hosting only if no headless-browser server is required

Severity: Medium implementation constraint, not a G00 blocker.

G06 must keep export behind an abstraction and prove Persian/RTL output with locally bundled licensed fonts. The architecture must not require Chromium/Playwright, Docker, a permanent Node process or a long-running render worker on the production shared host. Client-side raster/image export and/or PHP-compatible PDF rendering remain valid implementation candidates; the exact choice stays in G06 and must pass the export fixture/performance gate.

## Review result

After applying F1–F6 to the Source of Truth, there is no unresolved G00 architecture blocker.

The following existing decisions are accepted as sound:

- Telegram-only/free V1 scope
- TypeScript + React/Vite static client
- PHP 8.2+ request/response API + MySQL/MariaDB
- internal UUID independent of Telegram ID
- `business_id` tenant scoping
- no synchronous Bot API dependency for invoice creation
- deterministic money logic outside templates
- versioned templates
- immutable finalized/exported snapshots
- branch/PR gate discipline
- migration path to future web/paid identity without re-keying invoice history

## G00 PASS conditions

G00 can PASS when:

1. the required Source-of-Truth corrections in this review are merged;
2. Issue #1 records this review and owner acceptance of the already-stated V1 scope/non-goals;
3. `docs/CURRENT_EXECUTION_ORDER.md` moves current gate to G01.
