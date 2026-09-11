# G06 — Persian image/PDF export and Telegram sharing

Status: **IMPLEMENTED ON FEATURE BRANCH — NOT YET HUMAN-ACCEPTED**

## Owner-authorized scope

On 2026-09-11 the owner explicitly requested that the blocking Telegram preview/data-loss regression be fixed and G06 be implemented. This does not waive staging or Human Acceptance. Production remains out of scope.

## Preview and recovery prerequisite

- The preview is rendered through a body portal as a bottom-anchored, bounded sheet using Telegram's stable viewport height.
- Telegram Back closes the preview before changing application route.
- Unsubmitted form content, including official identity and every item, is auto-saved under a business-scoped local key and restored after accidental navigation/reload.
- Corrupt or unavailable browser storage never blocks the editor.

## Export implementation

- Issued documents expose separate high-resolution PNG, A4-landscape PDF and file-share actions.
- The active immutable settings snapshot selects the exact template and colour accent; export uses authoritative server totals and never recalculates money.
- Persian output is rendered with the locally bundled Vazirmatn font. PDF pages contain high-quality rendered template images, avoiding server-side browser/font dependencies.
- Documents are deterministically split at 12 item rows per A4 page; the 100-row fixture produces nine pages without dropping or duplicating rows.
- The final invoice omits pro-forma installment/payment destinations; pro-formas include all snapshotted payment accounts.
- Native Web Share with a PDF `File` is preferred. Where unavailable, the PDF is downloaded for manual Telegram attachment.
- Successful PNG/PDF/share operations create tenant-scoped export records containing document/version, template/version, format, byte size and timestamp. Generated files are not retained on shared hosting.
- Export cancellation/failure leaves the issued document and builder data unchanged and offers a retry message.

## Shared-host compatibility

Rendering happens on the client and the database stores metadata only. G06 adds no Chromium, Docker, Node daemon, render worker or unlimited generated-file storage to the PHP shared host.

## Acceptance still required

- exact-head CI and DB integration with migration `008_g06_document_exports.sql`;
- staging deployment and live health/smoke evidence on the same SHA;
- owner verification on Telegram Android and Desktop: preview Back behavior, restored draft, one-page and multipage PNG/PDF, Persian shaping, active template/theme, file sharing;
- real iOS remains deferred/not passed until G08 before G09.
