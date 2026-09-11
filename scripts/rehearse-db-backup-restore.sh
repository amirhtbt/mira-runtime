#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_ADMIN_USER:?DB_ADMIN_USER is required}"
: "${DB_ADMIN_PASSWORD:?DB_ADMIN_PASSWORD is required}"

if [[ ! "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Unsafe database name" >&2
  exit 1
fi

restore_db="${DB_NAME}_restore_${GITHUB_RUN_ID:-local}"
if [[ ! "$restore_db" =~ ^[A-Za-z0-9_]+$ || "$restore_db" == "$DB_NAME" ]]; then
  echo "Unsafe restore database name" >&2
  exit 1
fi

task_tmp="$(mktemp -d)"
dump_file="$task_tmp/database.sql"
source_counts="$task_tmp/source-counts.txt"
restore_counts="$task_tmp/restore-counts.txt"
export MYSQL_PWD="$DB_ADMIN_PASSWORD"

cleanup() {
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --execute="DROP DATABASE IF EXISTS \`$restore_db\`" >/dev/null 2>&1 || true
  unset MYSQL_PWD
  rm -rf "$task_tmp"
}
trap cleanup EXIT

mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --single-transaction --routines=false --triggers --no-tablespaces "$DB_NAME" >"$dump_file"
test -s "$dump_file"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --execute="CREATE DATABASE \`$restore_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" "$restore_db" <"$dump_file"

tables="$(mysql --batch --skip-column-names --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --execute="SELECT table_name FROM information_schema.tables WHERE table_schema='$DB_NAME' ORDER BY table_name")"
while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  source_count="$(mysql --batch --skip-column-names --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --execute="SELECT COUNT(*) FROM \`$DB_NAME\`.\`$table\`")"
  restored_count="$(mysql --batch --skip-column-names --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ADMIN_USER" --execute="SELECT COUNT(*) FROM \`$restore_db\`.\`$table\`")"
  printf '%s\t%s\n' "$table" "$source_count" >>"$source_counts"
  printf '%s\t%s\n' "$table" "$restored_count" >>"$restore_counts"
done <<<"$tables"

diff -u "$source_counts" "$restore_counts"
echo "Database backup/restore rehearsal PASS: schema and per-table row counts match."
