#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "dist/ is missing; run the frontend build first" >&2
  exit 1
fi

release_dir="${1:-deploy-package/release}"
sha="${GITHUB_SHA:-local}"
public_dir="$release_dir/server/public"

rm -rf "$release_dir"
mkdir -p "$release_dir"

# Keep the source-shaped tree for rollback/debug parity, but do not ship a
# source-tree .env. The live cPanel PHP handler can execute files from the web
# root but does not reliably expose newly deployed nested runtime directories,
# so the deployable runtime is flattened into HTTP-denied same-directory files.
cp -a server "$release_dir/server"
rm -f "$release_dir/server/.env"

rm -rf "$public_dir/tinv-runtime"
rm -f "$public_dir"/tinv-runtime-src-*.php
rm -f "$public_dir"/tinv-runtime-migration-*.sql

while IFS= read -r -d '' source_file; do
  relative="${source_file#server/src/}"
  flat="${relative%.php}"
  flat="${flat//\//__}"
  cp "$source_file" "$public_dir/tinv-runtime-src-$flat.php"
done < <(find server/src -type f -name '*.php' -print0 | sort -z)

while IFS= read -r -d '' migration_file; do
  cp "$migration_file" "$public_dir/tinv-runtime-migration-$(basename "$migration_file")"
done < <(find server/migrations -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

if [[ ! -f "$public_dir/tinv-runtime-bootstrap.php" || ! -f "$public_dir/tinv-runtime-runner.php" ]]; then
  echo "Flat shared-host runtime support files are missing" >&2
  exit 1
fi

# Frontend and PHP entry point share the same public origin.
cp -a dist/. "$public_dir/"
cp .env.example "$release_dir/.env.example"

cat > "$release_dir/BUILD_INFO" <<EOF
commit_sha=${sha}
built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gate=G01
web_document_root=server/public
php_runtime=server/public/tinv-runtime-bootstrap.php
runtime_layout=flat-public-http-denied
deploy_mode=direct-ftps-no-artifact
EOF

echo "Prepared shared-host release at $release_dir"
