#!/usr/bin/env bash
set -euo pipefail

: "${STAGING_FTPS_HOST:?STAGING_FTPS_HOST is required}"
: "${STAGING_FTPS_USER:?STAGING_FTPS_USER is required}"
: "${STAGING_FTPS_PASSWORD:?STAGING_FTPS_PASSWORD is required}"
: "${STAGING_ORIGIN:?STAGING_ORIGIN is required}"

runner_tmp="${RUNNER_TEMP:-/tmp}"
probe_token="$(openssl rand -hex 32)"
probe_hash="$(printf '%s' "$probe_token" | sha256sum | awk '{print $1}')"
probe_name=".tinv-probe-$(openssl rand -hex 12).php"
probe_file="$runner_tmp/$probe_name"
probe_output="$runner_tmp/tinv-php-filesystem-probe.txt"
remote_probe="server/public/$probe_name"

export LFTP_PASSWORD="$STAGING_FTPS_PASSWORD"
lftp_common="set cmd:fail-exit yes; set net:timeout 20; set net:max-retries 2; set ftp:ssl-force yes; set ftp:ssl-protect-data yes; set ssl:verify-certificate yes; open --user \"$STAGING_FTPS_USER\" --env-password -p 21 ftp://$STAGING_FTPS_HOST;"

cleanup() {
  unset LFTP_PASSWORD || true
  rm -f "$probe_file" "$probe_output"
  lftp -c "$lftp_common rm '$remote_probe'; bye" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cat > "$probe_file" <<EOF
<?php
declare(strict_types=1);
if ((\$_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(404);
    exit;
}
\$provided = (string) (\$_SERVER['HTTP_X_TINV_DEPLOY_TOKEN'] ?? '');
if (!hash_equals('$probe_hash', hash('sha256', \$provided))) {
    http_response_code(404);
    exit;
}
header('Cache-Control: no-store');
header('Content-Type: text/plain; charset=utf-8');
\$runtime = __DIR__ . '/tinv-runtime';
\$checks = [
    'self_file' => is_file(__FILE__),
    'self_readable' => is_readable(__FILE__),
    'cwd_dir' => is_dir(__DIR__),
    'index_file' => is_file(__DIR__ . '/index.php'),
    'runtime_dir' => is_dir(\$runtime),
    'runtime_migrate_file' => is_file(\$runtime . '/bin/migrate.php'),
    'runtime_migrate_readable' => is_readable(\$runtime . '/bin/migrate.php'),
    'runtime_env_file' => is_file(__DIR__ . '/tinv-runtime.env'),
    'runtime_env_readable' => is_readable(__DIR__ . '/tinv-runtime.env'),
    'open_basedir_set' => ((string) ini_get('open_basedir')) !== '',
];
@unlink(__FILE__);
echo 'php_filesystem_probe';
foreach (\$checks as \$key => \$value) {
    echo ' ' . \$key . '=' . (\$value ? '1' : '0');
}
echo "\n";
EOF
chmod 600 "$probe_file"

lftp -c "$lftp_common put '$probe_file' -o '$remote_probe'; bye"

probe_url="${STAGING_ORIGIN%/}/$probe_name"
probe_code="$(curl --silent --show-error --max-time 30 \
  --request POST \
  -H "X-Tinv-Deploy-Token: $probe_token" \
  -o "$probe_output" \
  -w '%{http_code}' \
  "$probe_url" || true)"

if [[ "$probe_code" != "200" ]] || ! grep -q '^php_filesystem_probe ' "$probe_output"; then
  echo "PHP filesystem probe failed with HTTP ${probe_code:-000}" >&2
  exit 1
fi

cat "$probe_output"
