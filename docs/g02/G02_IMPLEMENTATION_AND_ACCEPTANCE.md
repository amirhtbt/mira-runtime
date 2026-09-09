# G02 Implementation & Acceptance

Gate: G02 / Issue #3  
Status: implementation branch active  
Branch: `g02/animated-rtl-app-shell`

## Product surface

- RTL-first, Persian-first, mobile-first shell with Telegram light/dark tokens.
- Locally bundled variable Vazirmatn font; no runtime font/CDN dependency.
- Home / Invoices / Settings navigation and prominent central `+ پیش‌فاکتور` intent.
- New-user empty Home with immediate CTA and no invented records.
- Returning-user `HomeData` boundary for recent invoices and business/settings status; test fixtures do not enter production state.
- Designed loading, authentication error, offline and retry states.
- Telegram viewport/content-safe-area CSS synchronization, BackButton cleanup and haptic feedback.
- Desktop frame and keyboard focus fallback.

## RTL, accessibility and motion

- Structural `dir=rtl` from the document root.
- Mixed IDs use explicit LTR `bdi`; dates and amounts use isolation to prevent visual reordering.
- Navigation and actions meet the 44 px target; semantic headings, nav label, `aria-current`, alert/status roles and visible keyboard focus are covered.
- Motion is limited to short state/feedback transitions. `prefers-reduced-motion`, low-core/low-memory devices and slow-update media receive static fallbacks.
- Functional icons are local inline SVG; no icon or animation runtime dependency.

## Automated evidence

- TypeScript typecheck, Vitest component/unit tests, production build and client/repository secret scans.
- Existing G01 PHP auth/session unit and DB-backed integration coverage remains unchanged.
- Playwright visual baselines cover Android narrow, Android normal, iPhone-class simulated and Desktop in light/dark.
- Visual tests also assert no horizontal overflow, keyboard focus, central CTA navigation, safe-area variables and minimum CTA target size.
- The iPhone-class viewport is simulated coverage and is not real iOS acceptance.

## Performance evidence

- Local pre-PR build: client JS 80.92 KB gzip (258.48 KB raw), CSS 3.95 KB gzip, and bundled font subsets total 102.68 KB raw. Exact PR-head CI remains authoritative.
- Initial JS budget: <= 300 KB compressed.
- No motion/icon framework was added; interactions update local shell state only.

## G01 acceptance carried forward

G01 / Issue #2 is PASS / CLOSED. Desktop and Android human acceptance passed. PR #39's native Persian menu-button bidi fix is accepted. iOS remains explicitly DEFERRED, NOT PASSED, to G08/pre-pilot before G09.

## Remaining G02 acceptance

After exact-head CI, review, merge and exact-SHA staging deploy, the owner checks only on Android: Home, all three tabs, Light/Dark switch, short transition feedback, central CTA, and screenshots. Desktop is self-checked where available. iOS is not requested during G02.
