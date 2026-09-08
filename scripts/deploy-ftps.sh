#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_FTPS_HOST:?STAGING_FTPS_HOST is required}"
: "${STAGING_FTPS_USER:?STAGING_FTPS_USER is required}"
: "${STAGING_FTPS_PASSWORD:?STAGING_FTPS_PASSWORD is required}"
: "${STAGING_ORIGIN:?STAGING_ORIGIN is required}"

release_dir="${1:-deploy-package/release}"
backup_dir="${RUNNER_TEMP:-/tmp}/tinv-staging-rollback"

if [[ ! -d "$release_dir/server/public" ]]; then
  echo "Release directory is incomplete: $release_dir" >&2
  exit 1
fi

case "$STAGING_ORIGIN" in
  https://*) ;;
  *) echo "STAGING_ORIGIN must be HTTPS" >&2; exit 1 ;;
esac

rm -rf "$backup_dir"
mkdir -p "$backup_dir"

netrc="$HOME/.netrc"
umask 077
cat > "$netrc" <<EOF
machine $STAGING_FTPS_HOST
login $STAGING_FTPS_USER
password $STAGING_FTPS_PASSWORD
EOF
chmod 600 "$netrc"

lftp_common="set cmd:fail-exit yes; set net:timeout 20; set net:max-retries 2; set ftp:ssl-force yes; set ftp:ssl-protect-data yes; set ssl:verify-certificate yes; open -p 21 ftp://$STAGING_FTPS_HOST;"

cleanup() {
  rm -f "$netrc"
}
trap cleanup EXIT

# SAFETY CONTRACT:
# The FTP user MUST be jailed/chrooted by cPanel to the dedicated Mini App
# staging application root. Remote ./ must never be the account home or
# Box4U WordPress root.
echo "Backing up current staging tree inside the ephemeral GitHub runner..."
lftp -c "$lftp_common mirror --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota ./ '$backup_dir'; bye"

deploy() {
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota '$release_dir' ./; bye"
}

rollback() {
  echo "Restoring previous staging tree..." >&2
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota '$backup_dir' ./; bye" || true
}

echo "Deploying commit-addressed release directly to cPanel staging..."
if ! deploy; then
  rollback
  exit 1
fi

health_url="${STAGING_ORIGIN%/}/api/v1/health"
echo "Waiting for staging health endpoint..."
healthy=0
for attempt in 1 2 3 4 5; do
  if curl --fail --silent --show-error --max-time 15 "$health_url" >/tmp/tinv-health.json; then
    healthy=1
    break
  fi
  sleep $((attempt * 2))
done

if [[ "$healthy" != "1" ]]; then
  echo "Staging smoke check failed; rolling back file deployment." >&2
  rollback
  exit 1
fi

if ! grep -q 'telegram-invoice-api' /tmp/tinv-health.json; then
  echo "Unexpected health payload; rolling back file deployment." >&2
  rollback
  exit 1
fi

echo "Staging deploy and health smoke check PASS."
