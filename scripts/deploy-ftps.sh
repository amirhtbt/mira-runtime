#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_FTPS_HOST:?STAGING_FTPS_HOST is required}"
: "${STAGING_FTPS_USER:?STAGING_FTPS_USER is required}"
: "${STAGING_FTPS_PASSWORD:?STAGING_FTPS_PASSWORD is required}"
: "${STAGING_ORIGIN:?STAGING_ORIGIN is required}"
: "${STAGING_TELEGRAM_BOT_TOKEN:?STAGING_TELEGRAM_BOT_TOKEN is required}"
: "${STAGING_SESSION_PEPPER:?STAGING_SESSION_PEPPER is required}"
: "${STAGING_DB_NAME:?STAGING_DB_NAME is required}"
: "${STAGING_DB_USER:?STAGING_DB_USER is required}"
: "${STAGING_DB_PASSWORD:?STAGING_DB_PASSWORD is required}"

STAGING_DB_HOST="${STAGING_DB_HOST:-localhost}"
STAGING_DB_PORT="${STAGING_DB_PORT:-3306}"
STAGING_OWNER_TELEGRAM_USER_ID="${STAGING_OWNER_TELEGRAM_USER_ID:-}"
if [[ -n "$STAGING_OWNER_TELEGRAM_USER_ID" && ! "$STAGING_OWNER_TELEGRAM_USER_ID" =~ ^[1-9][0-9]{0,19}$ ]]; then
  echo "STAGING_OWNER_TELEGRAM_USER_ID must be a positive numeric Telegram ID" >&2
  exit 1
fi

release_dir="${1:-deploy-package/release}"
runner_tmp="${RUNNER_TEMP:-/tmp}"
backup_dir="$runner_tmp/tinv-staging-rollback"
env_backup="$runner_tmp/tinv-staging-env-backup"
runtime_env="$runner_tmp/tinv-staging.env"
migration_log="$runner_tmp/tinv-migrate.log"
migrator_file=""
runtime_env_remote="server/public/tinv-runtime.env"
legacy_env_remote="server/.env"

if [[ ! -f "$release_dir/server/public/tinv-runtime-bootstrap.php" \
   || ! -f "$release_dir/server/public/tinv-runtime-runner.php" \
   || ! -f "$release_dir/server/public/tinv-runtime-src-Config.php" \
   || ! -f "$release_dir/server/public/tinv-runtime-src-Database.php" \
   || ! -f "$release_dir/server/public/tinv-runtime-src-Support__Env.php" ]]; then
  echo "Release directory is incomplete: flat PHP runtime missing" >&2
  exit 1
fi

if ! find "$release_dir/server/public" -maxdepth 1 -type f -name 'tinv-runtime-migration-*.sql' | grep -q .; then
  echo "Release directory is incomplete: migration SQL missing" >&2
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

if [[ ! "$STAGING_FTPS_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "STAGING_FTPS_HOST contains unsupported characters" >&2
  exit 1
fi
if [[ ! "$STAGING_FTPS_USER" =~ ^[A-Za-z0-9._@+-]+$ ]]; then
  echo "STAGING_FTPS_USER contains unsupported characters" >&2
  exit 1
fi

rm -rf "$backup_dir" "$env_backup" "$runtime_env" "$migration_log"
mkdir -p "$backup_dir"

export LFTP_PASSWORD="$STAGING_FTPS_PASSWORD"
lftp_common="set cmd:fail-exit yes; set net:timeout 20; set net:max-retries 2; set ftp:ssl-force yes; set ftp:ssl-protect-data yes; set ssl:verify-certificate yes; open --user \"$STAGING_FTPS_USER\" --env-password -p 21 ftp://$STAGING_FTPS_HOST;"

cleanup() {
  unset LFTP_PASSWORD || true
  rm -f "$runtime_env" "$env_backup" "$migration_log"
  if [[ -n "$migrator_file" ]]; then rm -f "$migrator_file"; fi
}
trap cleanup EXIT

echo "Backing up current staging tree inside the ephemeral GitHub runner..."
lftp -c "$lftp_common mirror --verbose --parallel=2 --exclude-glob '$legacy_env_remote' --exclude-glob '$runtime_env_remote' --exclude-glob .ftpquota --exclude-glob 'release/**' --exclude-glob 'tinv-staging-rollback/**' ./ '$backup_dir'; bye"

had_remote_env=0
if lftp -c "$lftp_common get '$runtime_env_remote' -o '$env_backup'; bye" >/dev/null 2>&1; then
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
AUTH_RATE_LIMIT_PER_MINUTE=30
WRITE_RATE_LIMIT_PER_MINUTE=120
OWNER_TELEGRAM_USER_ID=$STAGING_OWNER_TELEGRAM_USER_ID
EOF
chmod 600 "$runtime_env"

deploy_files() {
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob '$legacy_env_remote' --exclude-glob '$runtime_env_remote' --exclude-glob .ftpquota '$release_dir' ./; bye"
}

# Live cPanel evidence shows files written with an explicit FTP PUT are visible
# to the PHP handler immediately, while files created only through lftp mirror
# can remain invisible to PHP even though FTP directory listings show them.
# Keep mirror for full-tree sync/delete semantics, then explicitly publish every
# webroot file through PUT so the exact bytes PHP serves are on the proven path.
publish_public_files() {
  local public_dir="$release_dir/server/public"
  local commands=""
  local local_file rel remote remote_dir

  while IFS= read -r -d '' local_file; do
    rel="${local_file#"$public_dir"/}"
    if [[ "$rel" == *"'"* || "$rel" == *$'\n'* || "$rel" == *$'\r'* ]]; then
      echo "Unsupported character in public release path" >&2
      return 1
    fi
    remote="server/public/$rel"
    remote_dir="${remote%/*}"
    commands+="mkdir -pf '$remote_dir'; put '$local_file' -o '$remote'; "
  done < <(find "$public_dir" -type f -print0 | sort -z)

  if [[ -z "$commands" ]]; then
    echo "No public release files found for direct publication" >&2
    return 1
  fi

  lftp -c "$lftp_common $commands bye"
}

upload_runtime_env() {
  lftp -c "$lftp_common put '$runtime_env' -o '$runtime_env_remote'; chmod 600 '$runtime_env_remote'; bye"
}

restore_runtime_env() {
  if [[ "$had_remote_env" == "1" ]]; then
    lftp -c "$lftp_common put '$env_backup' -o '$runtime_env_remote'; chmod 600 '$runtime_env_remote'; bye" || true
  else
    lftp -c "$lftp_common rm '$runtime_env_remote'; bye" >/dev/null 2>&1 || true
  fi
}

rollback() {
  echo "Restoring previous staging tree..." >&2
  lftp -c "$lftp_common mirror --reverse --delete --verbose --parallel=2 --exclude-glob '$legacy_env_remote' --exclude-glob '$runtime_env_remote' --exclude-glob .ftpquota '$backup_dir' ./; bye" || true
  restore_runtime_env
}

echo "Deploying commit-addressed release directly to cPanel staging..."
if ! deploy_files; then
  rollback
  exit 1
fi

if ! publish_public_files; then
  echo "Direct webroot publication failed; rolling back." >&2
  rollback
  exit 1
fi

if ! upload_runtime_env; then
  echo "Runtime environment upload failed; rolling back." >&2
  rollback
  exit 1
fi

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
try {
    \$runnerPath = __DIR__ . '/tinv-runtime-runner.php';
    \$bootstrapPath = __DIR__ . '/tinv-runtime-bootstrap.php';
    \$envPath = __DIR__ . '/tinv-runtime.env';
    \$migrationFiles = glob(__DIR__ . '/tinv-runtime-migration-*.sql') ?: [];
    if (!is_file(\$runnerPath) || !is_readable(\$runnerPath)) {
        http_response_code(500);
        echo 'migration_error=php_runtime type=PathUnavailable'
            . ' index=' . (is_file(__DIR__ . '/index.php') ? '1' : '0')
            . ' bootstrap=' . (is_file(\$bootstrapPath) ? '1' : '0')
            . ' runner=' . (is_file(\$runnerPath) ? '1' : '0')
            . ' env=' . (is_file(\$envPath) ? '1' : '0')
            . ' migration=' . (count(\$migrationFiles) > 0 ? '1' : '0')
            . "\n";
        exit;
    }

    if (function_exists('opcache_invalidate')) {
        foreach ([
            \$runnerPath,
            \$bootstrapPath,
            __DIR__ . '/tinv-runtime-src-Config.php',
            __DIR__ . '/tinv-runtime-src-Database.php',
            __DIR__ . '/tinv-runtime-src-Support__Env.php',
        ] as \$cacheFile) {
            if (is_file(\$cacheFile)) {
                @opcache_invalidate(\$cacheFile, true);
            }
        }
    }

    require \$runnerPath;
} catch (\PDOException \$exception) {
    http_response_code(500);
    \$errorInfo = is_array(\$exception->errorInfo ?? null) ? \$exception->errorInfo : [];
    \$sqlState = preg_replace('/[^A-Za-z0-9]/', '', (string) (\$errorInfo[0] ?? 'unknown')) ?: 'unknown';
    \$driverCode = preg_replace('/[^0-9]/', '', (string) (\$errorInfo[1] ?? '')) ?: 'unknown';
    echo 'migration_error=pdo sqlstate=' . \$sqlState . ' driver=' . \$driverCode . "\n";
    exit;
} catch (\RuntimeException \$exception) {
    http_response_code(500);
    echo "migration_error=runtime_config\n";
    exit;
} catch (\Throwable \$exception) {
    http_response_code(500);
    \$type = \$exception instanceof \ParseError ? 'ParseError'
        : (\$exception instanceof \TypeError ? 'TypeError'
        : (\$exception instanceof \Error ? 'Error' : 'Throwable'));
    echo 'migration_error=php_runtime type=' . \$type
        . ' php=' . PHP_VERSION_ID
        . ' pdo=' . (extension_loaded('PDO') ? '1' : '0')
        . ' pdo_mysql=' . (extension_loaded('pdo_mysql') ? '1' : '0')
        . ' getenv=' . (function_exists('getenv') ? '1' : '0')
        . ' dirname=' . (function_exists('dirname') ? '1' : '0')
        . ' opcache_invalidate=' . (function_exists('opcache_invalidate') ? '1' : '0')
        . "\n";
    exit;
}
EOF
chmod 600 "$migrator_file"

remote_migrator="server/public/$migrator_name"
if ! lftp -c "$lftp_common put '$migrator_file' -o '$remote_migrator'; bye"; then
  echo "Could not upload ephemeral migration bridge; rolling back." >&2
  rollback
  exit 1
fi

migration_url="${STAGING_ORIGIN%/}/$migrator_name"
migration_code="$(curl --silent --show-error --max-time 30 \
  --request POST \
  -H "X-Tinv-Deploy-Token: $migration_token" \
  -o "$migration_log" \
  -w '%{http_code}' \
  "$migration_url" || true)"

if [[ "$migration_code" != "200" ]]; then
  lftp -c "$lftp_common rm '$remote_migrator'; bye" >/dev/null 2>&1 || true
  if [[ -s "$migration_log" ]] && grep -Eq '^migration_error=(pdo|runtime_config|php_runtime)( |$)' "$migration_log"; then
    cat "$migration_log" >&2
  else
    echo "migration_error=http_${migration_code:-000}" >&2
  fi
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

runtime_paths=(
  "tinv-runtime-bootstrap.php"
  "tinv-runtime-runner.php"
  "tinv-runtime.env"
  "tinv-runtime-migration-001_g01_foundation.sql"
  "tinv-runtime-src-Config.php"
)
for runtime_path in "${runtime_paths[@]}"; do
  runtime_http_code="$(curl --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' "${STAGING_ORIGIN%/}/$runtime_path" || true)"
  if [[ "$runtime_http_code" != "403" && "$runtime_http_code" != "404" ]]; then
    echo "Shared-host runtime HTTP-deny smoke check failed for a protected runtime path; rolling back." >&2
    rollback
    exit 1
  fi
done

frontend_code="$(curl --silent --show-error --max-time 20 -D /tmp/tinv-frontend-headers -o /tmp/tinv-frontend.html -w '%{http_code}' "${STAGING_ORIGIN%/}/" || true)"
if [[ "$frontend_code" != "200" ]] || ! grep -qi '<div id="root">' /tmp/tinv-frontend.html; then
  echo "Staging frontend smoke check failed; rolling back." >&2
  rollback
  exit 1
fi

robots_header="$(tr -d '\r' </tmp/tinv-frontend-headers | awk 'BEGIN { IGNORECASE=1 } /^X-Robots-Tag:/ { print tolower($0) }')"
for directive in noindex nofollow noarchive; do
  if [[ "$robots_header" != *"$directive"* ]]; then
    echo "Staging noindex header check failed; rolling back." >&2
    rollback
    exit 1
  fi
done

lftp -c "$lftp_common rm '$legacy_env_remote'; bye" >/dev/null 2>&1 || true
lftp -c "$lftp_common rm -r release; bye" >/dev/null 2>&1 || true
lftp -c "$lftp_common rm -r tinv-staging-rollback; bye" >/dev/null 2>&1 || true

echo "Staging deploy, migration, health, DB/config readiness, complete runtime HTTP-deny, frontend and noindex PASS."
