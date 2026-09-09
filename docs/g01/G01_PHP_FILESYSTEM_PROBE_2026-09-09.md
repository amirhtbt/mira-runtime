# G01 PHP filesystem probe — 2026-09-09

Purpose: diagnose the remaining cPanel/PHP runtime visibility blocker without exposing secrets or weakening the staging gate.

Context:
- PR #31 merged at `1cbe512d49260e246f16a00b0cfaebc139c48052`.
- Staging deploy run `34341314103` successfully completed frontend build/tests, PHP unit/integration tests, release packaging, FTPS connection and file upload.
- The one-shot migration bridge still returned `migration_error=php_runtime type=PathUnavailable` while `server/public/tinv-runtime/bin/migrate.php` had been transferred by FTPS.
- Rollback completed after the failed migration.

Probe branch: `g01/php-filesystem-probe`
Head at documentation creation: `cb8d1ab496bbdc3d25baa9c23832588795faa429`.

The probe is designed to be temporary, token-protected, redacted and self-deleting. It does not print secrets or raw absolute filesystem paths. Its only purpose is to report safe boolean/runtime facts needed to distinguish PHP document-root mapping, `open_basedir`, and file-readability behavior before the normal deploy step.

G01 remains OPEN until staging migration, health/DB readiness and Telegram client acceptance all pass.
