# G04.1 — New Document builder implementation

Issue: #57

## Implemented contract

- one continuous scroll page; no wizard and no duplicated customer fields;
- required customer/company name and Iranian mobile;
- tenant-scoped reusable customer profiles with normalized `09…` / `+98…` lookup and explicit save/update;
- optional address, shipping, validity and notes accordions;
- official toggle with required national ID;
- unlimited practical item rows with add/remove/reorder, quantity, integer-Rial price and row discount;
- unofficial VAT zero; official VAT sourced from Settings (default 10%) and snapshotted;
- automatic collision-safe document numbering and Jalali issue/expiry presentation;
- multiple deposit accounts in Settings, with legacy payment fields preserved for compatibility;
- preview, issuance and post-issuance share action in the same flow;
- issued customer/settings/tax/item snapshots remain immutable and final invoices omit installment detail.

## Boundaries

PDF/image export and file-based Telegram sharing remain G06. The G04.1 share action shares the issued document summary; it does not pretend that PDF export already exists. V1 does not claim Samaneh Moadian compliance.

## Required evidence before acceptance

- frontend typecheck, unit, build, secret scan and visual suites;
- PHP syntax, migrations, Settings and sales integration suites;
- exact-PR-head CI;
- exact-merge-SHA staging deploy and built-in live smoke;
- owner Android/Desktop acceptance.
