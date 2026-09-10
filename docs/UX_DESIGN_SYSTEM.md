# UX & Design System

## 1. Product personality

- premium but friendly
- modern, minimal, visual
- Persian-first
- not visually associated with accounting software
- motion used to communicate state, not decorate everything

Concept: "Canva-like presentation quality with the speed of a utility app."

## 2. UX laws

1. One obvious primary action per screen.
2. Normal invoice creation must not expose advanced accounting-style controls.
3. Advanced parameters live in Settings or progressive disclosure.
4. Default values must be good enough to produce a shareable invoice without configuration.
5. Never require product/customer database setup before making an invoice.
6. Show immediate visual feedback for quantity/price/discount changes.
7. Preserve drafts automatically.

## 3. Main navigation

Recommended V1 bottom navigation:
- خانه
- فاکتورها
- تنظیمات

Primary floating/central action:
- `+ سند جدید`

The next surface has only two choices: `پیش‌فاکتور` (default) and `فاکتور فروش`. Both reuse the same editor. A pro-forma detail has one clear `ثبت پرداخت` action and its remaining amount. After exact full settlement, that action becomes `صدور فاکتور نهایی`. Installment details stay on the pro-forma and are not shown on the final invoice. Direct invoice creation requires a simple full-payment confirmation. Do not add separate creation modules or accounting-style navigation.

Do not add tabs without validated usage.

## 4. Motion system

Allowed:
- short entrance transitions
- spring feedback on add/remove
- animated totals
- subtle template-card movement
- skeleton transitions
- haptic feedback for primary confirmations when supported
- success completion animation

Avoid:
- long splash animations
- motion that blocks invoice entry
- continuous background animation
- expensive blur/parallax on low-end devices

Rules:
- respect `prefers-reduced-motion`
- allow performance-based motion downgrade
- every animation must have a reduced/static fallback
- input must never wait for an animation

## 5. Telegram-native integration

Support:
- Telegram light/dark theme parameters
- viewport changes
- safe-area insets
- Telegram Back Button
- haptic feedback where useful
- main/bottom buttons only when they improve clarity

The invoice document itself may retain its chosen template appearance independently of Telegram dark mode; the surrounding app UI should adapt.

## 6. RTL and Persian

- complete RTL layout
- Vazirmatn or another properly licensed/readable Persian UI font
- Persian text rendering QA on Android/iOS/Desktop Telegram
- controllable Persian/Latin digits for invoice output
- currency label and number direction must never visually reorder incorrectly
- mixed Persian/English/SKU strings must be tested

## 7. Accessibility

- minimum practical tap target ~44 px
- no meaning carried by color alone
- WCAG-oriented contrast targets
- semantic labels for interactive controls
- focus states for desktop/keyboard where relevant
- scalable text without layout breakage

## 8. Empty/error states

Must be visually designed, not raw error text:
- no invoices yet
- network retry
- export failure
- invalid Telegram session
- expired session
- upload rejected
- offline/draft preserved where feasible

## 9. First-run UX

Avoid a multi-screen tutorial.

Preferred:
- instant create path
- contextual tips on first use
- ask for business logo/name only when needed for output
- show value before asking the user to configure every setting
