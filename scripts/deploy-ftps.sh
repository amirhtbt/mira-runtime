#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_FTPS_HOST:?STAGING_FTPS_HOST is required}"
: "${STAGING_FTPS_USER:?STAGING_FTPS_USER is required}"
: "${STAGING_FTPS_PASSWORD:?STAGING_FTPS_PASSWORD is required}"
: "${STAGING_ORIGIN:?STAGING_ORIGIN is required}"
: "${STAGING_TELEGRAM_BOT_TOKEN:?STAGING_TELEGRAM_BOT_TOKEN is required}"
: "${STAGING_SESSION_PEPPER:?STAGING_SESSION_PEPPER is required}"
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"

STAGING_DB_HOST="${STAGING_DB_HOST:-localhost}"
STAGING_DB_PORT="${STAGING_DB_PORT:-3306}"
STAGING_DB_NAME="${STAGING_DB_NAME:-boxuco_invoice_stg}"
STAGING_DB_USER="${STAGING_DB_USER:-boxuco_invoice_stg}"

release_dir="${1:-deploy-package/release}"
runner_tmp="${RUNNER_TEMP:-/tmp}"
backup_dir="$runner_tmp/tinv-staging-rollback"
env_backup="$runner_tmp/tinv-staging-env-backup"
runtime_env="$runner_tmp/tinv-staging.env"
migrator_file=""

if [[ ! -d "$release_dir/server/public" ]]; then
  echo "Release directory is incomplete: $release_dir" >&2
  exit 1
fi

case "$STAGING_ORIGIN" in
  https://*) ;;
  *) echo "STAGING_ORIGIN must be HTTPS" >&2; exit 1 ;;
esac

if [[ ${#STAGING_SESSION_PEPPER} -lt 32 ]]; then
  echo "STAGING_SESSION_PEPPER must be at least 32 characters" >&2
  exit 1
fi

rm -rf "$backup_dir" "$env_backup" "$runtime_env"
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
  rm -f "$netrc" "$runtime_env" "$env_backup"
  if [[ -n "$migrator_file" ]]; then rm -f "$migrator_file"; fi
}
trap cleanup EXIT

# SAFETY CONTRACT:
# The FTP user MUST be jailed/chrooted by cPanel to the dedicated Mini App
# staging application root. Remote ./ must never be the account home or
# Box4U WordPress root.
echo "Backing up current staging tree inside the ephemeral GitHub runner..."
lftp -c "$lftp_common mirror --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota ./ '$backup_dir'; bye"

had_remote_env=0
if lftp -c "$lftp_common get server/.env -o '$env_backup'; bye" >/dev/null 2>&1; then
  had_remote_env=1
fi

cat > "$runtime_env" <<EOF
APP_ENV=staging
APP_ORIGIN=$STAGING_ORIGIN
TELEGRAM_BOT_TOKEN=$STAGING_TELEGRAM_BOT_TOKEN
SESSION_PEPPER=$STAGING_SESSION_PEPPER
DB_HOST=$STAGING_DB_HOST
DB_PORT=$STAGING_DB_PORT
DB_NAME=$STAGING_DB_NAME
DB_USER=$STAGING_DB_USER
DB_PASSWORD=$STAGING_DB_PASSWORD
AUTH_MAX_AGE_SECONDS=300
AUTH_FUTURE_SKEW_SECONDS=30
SESSION_IDLE_TTL_SECONDS=604800
SESSION_ABSOLUTE_TTL_SECONDS=2592000
SESSION_TOUCH_INTERVAL_SECONDS=300
EOF
chmod 600 "$runtime_env"

deploy_files() {
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota '$release_dir' ./; bye"
}

upload_runtime_env() {
  lftp -c "$lftp_common put '$runtime_env' -o server/.env; chmod 600 server/.env; bye"
}

restore_runtime_env() {
  if [[ "$had_remote_env" == "1" ]]; then
    lftp -c "$lftp_common put '$env_backup' -o server/.env; chmod 600 server/.env; bye" || true
  else
    lftp -c "$lftp_common rm server/.env; bye" >/dev/null 2>&1 || true
  fi
}

rollback() {
  echo "Restoring previous staging tree..." >&2
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob server/.env --exclude-glob .ftpquota '$backup_dir' ./; bye" || true
  restore_runtime_env
}

echo "Deploying commit-addressed release directly to cPanel staging..."
if ! deploy_files; then
  rollback
  exit 1
fi

if ! upload_runtime_env; then
  echo "Runtime environment upload failed; rolling back." >&2
  rollback
  exit 1
fi

# Shared hosting does not provide a deployment shell. Run migrations through a
# random, token-protected, POST-only, self-deleting PHP bridge that exists only
# for this deployment. No persistent migration endpoint is shipped.
migration_token="$(openssl rand -hex 32)"
migration_hash="$(printf '%s' "$migration_token" | sha256sum | awk '{print $1}')"
migrator_name=".tinv-migrate-$(openssl rand -hex 12).php"
migrator_file="$runner_tmp/$migrator_name"
cat > "$migrator_file" <<EOF
<?php
declare(strict_types=1);
if ((\$_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(404);
    exit;
}
\$provided = (string) (\$_SERVER['HTTP_X_TINV_DEPLOY_TOKEN'] ?? '');
if (!hash_equals('$migration_hash', hash('sha256', \$provided))) {
    http_response_code(404);
    exit;
}
@unlink(__FILE__);
header('Cache-Control: no-store');
header('Content-Type: text/plain; charset=utf-8');
require dirname(__DIR__) . '/bin/migrate.php';
EOF
chmod 600 "$migrator_file"

remote_migrator="server/public/$migrator_name"
if ! lftp -c "$lftp_common put '$migrator_file' -o '$remote_migrator'; bye"; then
  echo "Could not upload ephemeral migration bridge; rolling back." >&2
  rollback
  exit 1
fi

migration_url="${STAGING_ORIGIN%/}/$migrator_name"
if ! curl --fail --silent --show-error --max-time 30 \
  --request POST \
  -H "X-Tinv-Deploy-Token: $migration_token" \
  "$migration_url" >/tmp/tinv-migrate.log; then
  lftp -c "$lftp_common rm '$remote_migrator'; bye" >/dev/null 2>&1 || true
  echo "Staging migration failed; rolling back files and runtime environment." >&2
  rollback
  exit 1
fi
lftp -c "$lftp_common rm '$remote_migrator'; bye" >/dev/null 2>&1 || true

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

if [[ "$healthy" != "1" ]] || ! grep -q 'telegram-invoice-api' /tmp/tinv-health.json; then
  echo "Staging health smoke check failed; rolling back." >&2
  rollback
  exit 1
fi

# `/api/v1/session` initializes Config + PDO before returning 401 for an
# anonymous request, so this verifies the real staging .env and DB connection.
ready_url="${STAGING_ORIGIN%/}/api/v1/session"
ready=0
for attempt in 1 2 3 4 5; do
  ready_code="$(curl --silent --show-error --max-time 15 -o /tmp/tinv-ready.json -w '%{http_code}' "$ready_url" || true)"
  if [[ "$ready_code" == "401" ]] && grep -q 'unauthenticated' /tmp/tinv-ready.json; then
    ready=1
    break
  fi
  sleep $((attempt * 2))
done

if [[ "$ready" != "1" ]]; then
  echo "Staging configuration/DB readiness check failed; rolling back." >&2
  rollback
  exit 1
fi

echo "Staging deploy, migration, health and DB/config readiness PASS."
