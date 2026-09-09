# G01 temporary public-visibility audit — 2026-09-09

Gate: G01 / Issue #2

## Purpose

The owner intends to make this repository public temporarily so standard GitHub-hosted Actions can continue after the private-repository monthly Actions allowance was exhausted. The repository is expected to return to private visibility after the short implementation window.

## Secret audit result

No live production/staging secret value was found in the reviewed current tree or reviewed Actions logs.

Confirmed controls:

- `.env`, `.env.*` and `server/.env` are ignored; only `.env.example` is tracked.
- `.env.example` contains placeholders only.
- Telegram bot token, session pepper, FTPS password, FTPS endpoint/login, staging origin and DB credentials are consumed through GitHub Actions repository secrets.
- prior deployment logs mask repository-secret values as `***`.
- the failed FTPS deployment stopped at authentication before any application/runtime/migration mutation.
- the repository secret scan is extended in this public-readiness branch to inspect reachable Git history as well as the current tree for Telegram-token, GitHub-token, AWS-key and private-key patterns.
- deployment keeps `permissions: contents: read`; no `pull_request_target` workflow is used.
- deployment is triggered only by the maintainer-controlled `deploy/staging` branch or manual workflow dispatch; secrets are not needed by normal pull-request CI.

## Public-readiness hardening in this branch

- remove the exact staging DB name/user from workflow and deployment-script defaults; require them through repository secrets;
- extend secret scanning to reachable Git history;
- redact unnecessary host IP, FTP login, DB identifiers and cPanel account filesystem paths from current Issue #2 evidence comments.

## Residual exposure that cannot be undone by ordinary file/comment edits

Making the existing repository public exposes the repository's reachable Git history, commit metadata, PR/issue history and Actions history during the public window. Earlier commits/PR records may contain non-secret operational metadata such as the staging hostname, hosting topology, account resource limits, former DB identifiers or deployment design. Commit author metadata can also include the author's configured email address.

No password, bot token, session pepper or private key is known to have been committed or printed unmasked. Nevertheless, temporary public visibility must be treated as irreversible disclosure of source code and any non-secret metadata already present in history because third parties may clone/fork it.

## Required operator checklist before visibility is changed

1. Add repository secrets `STAGING_DB_NAME` and `STAGING_DB_USER` using the existing isolated staging DB/user values.
2. Do not remove or weaken existing secret masking/secret-scan/deployment-safety controls.
3. Change repository visibility only after this hardening PR has a successful public GitHub Actions run and is merged, or make the repository public first and immediately re-run this PR's checks before merge.
4. Do not accept untrusted code changes into `deploy/staging` while public.

## End-of-window checklist

After implementation is complete:

1. return the repository to private visibility;
2. verify no public fork/clone can be recalled — source exposure must be considered permanent;
3. rotate the dedicated staging FTPS password as a precaution;
4. optionally rotate the staging Telegram bot token/session pepper if the owner wants a clean post-public credential boundary, even though no value was observed exposed;
5. keep staging `noindex` until G01/G02 acceptance requires otherwise;
6. record the final visibility transition and credential-rotation evidence in Issue #2.

## Decision

Temporary public visibility is acceptable for this short G01 completion window **only because no live secret is known to be present in source/history/log output** and deployment secrets remain in GitHub's secret store. The owner explicitly accepts the irreversible source/history exposure risk of making the repository public.
