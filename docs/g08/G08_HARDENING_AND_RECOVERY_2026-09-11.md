# G08 — Security, performance and recovery hardening

Status: implementation in progress on 2026-09-11. Production is not authorized or modified.

## Implemented controls

- Authentication attempts are limited per privacy-preserving HMAC scope; authenticated mutations are limited per business. Limits are atomic in MariaDB and return HTTP 429 with `Retry-After`.
- Raw client IP addresses are not stored in the rate-limit table. Only keyed SHA-256 scope hashes are persisted.
- Every API response has a validated or server-generated `X-Request-Id`. Server errors log structured correlation metadata without raw exception messages, request bodies, Telegram init data, cookies or credentials.
- A business/time index covers payment history. The existing document-export and document/customer cursor indexes remain authoritative for export history and G07 pagination.
- Fingerprinted JavaScript, CSS and font assets are immutable-cacheable; the HTML shell is always revalidated.
- CI performs a real logical database backup, restores it into an explicitly named throwaway database and compares every table row count before deleting the throwaway database.
- Deployment keeps certificate-verified FTPS, exact-SHA checkout, migration ledgering, live health smoke and same-run recoverable file rollback.

## Configuration

| Variable | Default | Valid range | Scope |
|---|---:|---:|---|
| `AUTH_RATE_LIMIT_PER_MINUTE` | 30 | 5–300 | Telegram authentication attempts per hashed network scope |
| `WRITE_RATE_LIMIT_PER_MINUTE` | 120 | 10–1000 | Mutating API requests per authenticated business |

Changing either limit is an operational change and must be validated on staging. It must not be used to conceal abuse or application retry loops.

## Database restore rehearsal

Run only with a database administrator account that may create and drop a temporary database:

```bash
DB_ADMIN_USER=... DB_ADMIN_PASSWORD=... bash scripts/rehearse-db-backup-restore.sh
```

The script refuses unsafe database names, never overwrites the source database, uses a temporary directory, passes passwords through `MYSQL_PWD`, restores into `<source>_restore_<run-id>`, verifies the table set and all per-table row counts, and drops only that validated temporary target.

## Production recovery procedure

1. Stop writes or place the app in maintenance mode; record the failing release SHA and migration ledger.
2. Take a fresh logical backup of the current database even when it is unhealthy. Preserve the failed release files for diagnosis.
3. Restore the selected provider/application backup into a separate temporary database first. Verify tables, row counts, tenant isolation and representative documents.
4. Prepare the exact previously accepted application SHA. Do not reverse schema migrations destructively; prefer a forward corrective migration compatible with both releases.
5. Switch files/configuration only after verification, run health/auth/document/export smoke checks, and monitor correlated error logs.
6. If verification fails, keep production isolated and restore the pre-change file/config state. Record timings, data-loss window and decisions in Issue #9.

## Production go/no-go

Production is **NO-GO** until all of the following are evidenced on Issue #9:

- exact PR-head CI and exact merged-SHA staging deployment pass;
- provider backup schedule, retention and one recoverable restore path are confirmed;
- real Telegram iOS acceptance passes (simulation is not a substitute);
- no unresolved critical/high security issue exists;
- the owner explicitly authorizes production deployment.

The remaining G06 PDF/PNG/share acceptance is tracked separately and is not silently waived by G08.
