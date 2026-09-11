# Telegram Invoice Mini App — Source of Truth

Status: G07 PASS / G08 Active
Date: 2026-09-11

A Telegram-only Mini App for creating, recording and sharing visually polished pro-forma and final sales invoices, aimed at small Iranian sellers and online shops that do not use accounting software.

## Product promise

Create and share a professional, branded pro-forma invoice in under 30 seconds on first use and under 15 seconds for repeat use.

## MVP constraints

- Telegram Mini App only; no public website or standalone web product in V1.
- Free for all users during validation.
- Mobile-first, RTL-first, Persian-first.
- Visually rich and animated, but operationally simple.
- Advanced invoice parameters live in Settings rather than the primary creation flow.
- Templates are designed/added by the product team, not by end users in V1.
- Architecture must preserve a clean migration path to a future website, standalone web app, paid tiers, teams, payments and broader commerce tooling.
- The product is for pro-forma invoices / sales documents, not an official tax invoice system in V1.

## Current execution

Start every new implementation session from:

- `docs/CURRENT_EXECUTION_ORDER.md`
- the current GitHub Gate Issue

Current Gate: **G08 / Issue #9**. G07 history/search/reuse is merged, deployed and owner-accepted. G08 hardening is active; production remains untouched and real-iOS acceptance is still required before G09.

G00 architecture acceptance evidence:
- `docs/g00/G00_ARCHITECTURE_REVIEW_2026-09-08.md`

## Source-of-truth documents

- `docs/CURRENT_EXECUTION_ORDER.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/HOSTING_REQUIREMENTS.md`
- `docs/UX_DESIGN_SYSTEM.md`
- `docs/TEMPLATE_SYSTEM.md`
- `docs/TEST_STRATEGY.md`
- `docs/ROADMAP_AND_GATES.md`
- `docs/PILOT_AND_MIGRATION.md`
- `docs/GITHUB_BOOTSTRAP.md`

## Delivery rule

Each gate must have explicit acceptance criteria and automated/manual tests. A failed acceptance gate blocks progression unless an explicit owner decision records the exception.
