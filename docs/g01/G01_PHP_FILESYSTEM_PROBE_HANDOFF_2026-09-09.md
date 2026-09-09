# G01 PHP filesystem probe handoff

This handoff exists only to keep the current execution state explicit in GitHub.

Next execution order:
1. Require green G01 CI for this probe branch/PR.
2. Merge the probe change without weakening any security test.
3. Fast-forward `deploy/staging` to the merge SHA.
4. Read only the redacted probe result from the staging deploy job.
5. Correct the exact cPanel/PHP filesystem boundary identified by that result.
6. Re-run the normal direct FTPS deployment until migration + health + DB/config readiness pass.
7. Only then perform Telegram-client live acceptance and close G01.

Do not expose secrets, do not disable TLS verification, do not make the migration bridge persistent, and do not mark G01 PASS before real staging acceptance.
