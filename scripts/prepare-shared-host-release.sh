#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "dist/ is missing; run the frontend build first" >&2
  exit 1
fi

release_dir="${1:-deploy-package/release}"
sha="${GITHUB_SHA:-local}"

rm -rf "$release_dir"
mkdir -p "$release_dir"

# Backend/application source is deployed outside the subdomain document root.
cp -a server "$release_dir/server"
rm -f "$release_dir/server/.env"

# Frontend and PHP entry point share the same public origin.
cp -a dist/. "$release_dir/server/public/"
cp .env.example "$release_dir/.env.example"

cat > "$release_dir/BUILD_INFO" <<EOF
commit_sha=${sha}
built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gate=G01
web_document_root=server/public
deploy_mode=direct-ftps-no-artifact
EOF

echo "Prepared shared-host release at $release_dir"
