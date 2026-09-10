# G05 Implementation Record — 2026-09-10

Status: **SUPERSEDED VISUAL IMPLEMENTATION / CORRECTION IN PROGRESS**. The deployment evidence below remains historical evidence for the first G05 implementation, not acceptance of the revised design.

## Owner-approved correction

- move template selection into a dedicated fifth bottom-navigation tab, first from the left;
- keep three genuinely distinct structures: Minimal, Modern Business and Classic Business;
- support A4 landscape only; portrait is removed;
- separate colour theme from structural layout;
- persist the active layout/theme for all subsequently finalized document snapshots;
- provide full preview, zoom and explanatory content outside the sheet;
- remove the template selector/preview from Settings;
- preserve all conditional V1 fields, Rial-only amounts and final-invoice payment-history exclusion.

G05 must be redeployed and accepted again before PASS. G06 remains inactive.

## Implemented contract

- six approved, versioned templates including «تجاری کلاسیک»;
- portrait and landscape layouts for every template (12 variants);
- a normalized immutable `InvoiceViewModel` containing every defined V1 field;
- conditional rendering with no empty optional labels or reserved blank blocks;
- live template/orientation preview in business settings;
- restrained template-specific colour tokens;
- integer-Rial-only creation/defaults and explicit Rial labels;
- presentation-only template switching that cannot recalculate authoritative money;
- preservation of legacy issued records without silently changing historical amounts;
- pro-forma payment history remains linked in-app while final invoice rendering excludes deposit/installment breakdown;
- automated registry, orientation, conditional-field, Rial, 1/20/100-row and responsive overflow coverage.

Deferred to G06: PDF/image generation, print pagination and export-specific visual acceptance.

## Source and CI evidence

- Issue: #6
- Implementation PR: #53 — `G05: versioned Rial invoice template engine`
- PR head: `18db7907a16785682a89b6cc725a66131127eb22`
- PR-head Quality CI: run `34478630692` — PASS
- PR-head push Quality CI: run `34478596467` — PASS
- Squash merge on `main`: `d6230b365d952b9ad94e1bd6d3f0aece7fcfe79a`
- Merge-SHA Quality CI: run `34478818199` — PASS

## Exact-SHA staging deployment evidence

- `main` and `deploy/staging` were both verified at `d6230b365d952b9ad94e1bd6d3f0aece7fcfe79a` before this evidence-only documentation update.
- Direct cPanel Staging Deploy: run `34478903138`, job `102876440657` — PASS.
- Checkout log confirms exact SHA `d6230b365d952b9ad94e1bd6d3f0aece7fcfe79a` on `deploy/staging`.
- The release rebuilt from that checkout and deployed the current G05 frontend bundle and `004_g05_template_engine.sql` to isolated staging.
- The deployment migration bridge returned success; the staging runner processes all sorted migration files transactionally and records each version in the `migrations` ledger. `004_g05_template_engine.sql` was introduced by PR #53 and was present in this release. The workflow intentionally does not echo a successful migration response body, so there is no fabricated live `applied ...` line in this record.
- The same run's disposable CI database explicitly logged `applied 004_g05_template_engine.sql` before deployment.

## Staging smoke evidence

The exact-SHA deploy job completed its built-in live smoke checks successfully:

- health endpoint reachable and contains the expected `telegram-invoice-api` marker;
- session/config/DB readiness returns the expected unauthenticated `401` contract;
- protected shared-host runtime files remain HTTP-denied;
- staging frontend root returns HTTP 200 and the application root;
- `X-Robots-Tag` retains `noindex`, `nofollow`, and `noarchive`;
- current G05 release assets were transferred from the exact-SHA build;
- deployment finished with the repository's explicit `Staging deploy, migration, health, DB/config readiness, complete runtime HTTP-deny, frontend and noindex PASS.` guard.

Automated exact-source coverage additionally proves all six template names, both orientations, Rial-only rendering, no Toman output for new documents, and no horizontal page overflow at a 390×844 viewport. G04 backend regression coverage proves partial payment, full settlement, one-time conversion, preservation of pro-forma payment history, omission of payment breakdown from the final invoice, and direct fully-paid invoice creation.

The following are intentionally **Human Acceptance**, not fabricated automated live claims, because they require the authenticated Telegram Mini App interaction and visual inspection on real clients: opening Settings in the real session, visually selecting all six templates and both orientations, verifying complete/conditional seller-customer fields, end-to-end pro-forma payment UI, conversion UI, and Android/Desktop visual usability. Real iOS remains DEFERRED / NOT PASSED to G08 before G09.

## Gate state

**G05 — DEPLOYED / HUMAN ACCEPTANCE READY**

Do not close Issue #6, declare G05 PASS, activate G06, or modify Production until the owner explicitly accepts the Human Acceptance checklist.
