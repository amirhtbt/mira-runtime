#!/usr/bin/env bash
set -euo pipefail

tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)"
if [[ -n "$tracked_env" ]]; then
  echo "Tracked environment secret file(s) are forbidden:"
  echo "$tracked_env"
  exit 1
fi

secret_pattern='([0-9]{6,12}:[A-Za-z0-9_-]{30,})|(gh[pousr]_[A-Za-z0-9]{30,})|(AKIA[0-9A-Z]{16})|(-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----)'

if git grep -nE "$secret_pattern" -- ':!docs/**' ':!tests/**'; then
  echo "Possible live credential or private key detected in current repository tree."
  exit 1
fi

# Before any temporary public-visibility window, scan the full reachable Git
# history as well as HEAD. Deleted credentials are still public if they remain
# in commit history, so a current-tree-only scan is insufficient.
if git log --all -p --no-ext-diff --text --pretty=format: | grep -E "$secret_pattern" >/dev/null; then
  echo "Possible live credential or private key detected in reachable git history."
  exit 1
fi

echo "secret scan PASS (current tree + reachable history)"
