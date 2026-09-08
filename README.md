# Telegram Invoice Mini App — Source of Truth

Status: Product Definition / G00
Date: 2026-09-08

A Telegram-only Mini App for creating visually polished, brandable pro-forma invoices / sales quotations in seconds, aimed at small Iranian sellers and online shops that do not use accounting software.

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

## Source-of-truth documents

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/HOSTING_REQUIREMENTS.md`
- `docs/UX_DESIGN_SYSTEM.md`
- `docs/TEMPLATE_SYSTEM.md`
- `docs/TEST_STRATEGY.md`
- `docs/ROADMAP_AND_GATES.md`
- `docs/PILOT_AND_MIGRATION.md`

## Delivery rule

Each gate must have explicit acceptance criteria and automated/manual tests. A failed acceptance gate blocks progression unless an explicit owner decision records the exception.
