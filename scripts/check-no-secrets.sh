#!/usr/bin/env bash
set -euo pipefail

tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)"
if [[ -n "$tracked_env" ]]; then
  echo "Tracked environment secret file(s) are forbidden:"
  echo "$tracked_env"
  exit 1
fi

if git grep -nE '[0-9]{6,12}:[A-Za-z0-9_-]{30,}' -- ':!docs/**' ':!tests/**'; then
  echo "Possible Telegram bot token detected in repository."
  exit 1
fi

if git grep -nE -- '-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----'; then
  echo "Private key material detected in repository."
  exit 1
fi

echo "secret scan PASS"
