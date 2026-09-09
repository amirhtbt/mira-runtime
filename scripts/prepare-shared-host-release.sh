#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "dist/ is missing; run the frontend build first" >&2
  exit 1
fi

release_dir="${1:-deploy-package/release}"
sha="${GITHUB_SHA:-local}"
runtime_dir="$release_dir/server/public/tinv-runtime"

rm -rf "$release_dir"
mkdir -p "$release_dir"

# Keep the source-shaped tree for rollback/debug parity, but do not ship a
# source-tree .env. Some shared-host PHP configurations restrict filesystem
# access to the configured DocumentRoot, so the executable runtime is also
# copied into an HTTP-denied directory inside server/public. Use a normal
# directory name because the live cPanel/PHP boundary does not reliably expose
# files inside hidden dot-directories to PHP even though FTPS can upload them.
cp -a server "$release_dir/server"
rm -f "$release_dir/server/.env"

rm -rf "$runtime_dir"
mkdir -p "$runtime_dir"
cp server/bootstrap.php "$runtime_dir/bootstrap.php"
cp -a server/src "$runtime_dir/src"
cp -a server/migrations "$runtime_dir/migrations"
cp -a server/bin "$runtime_dir/bin"
cat > "$runtime_dir/.htaccess" <<'EOF'
Options -Indexes
<IfModule mod_authz_core.c>
  Require all denied
</IfModule>
<IfModule !mod_authz_core.c>
  Order allow,deny
  Deny from all
</IfModule>
EOF

# Frontend and PHP entry point share the same public origin.
cp -a dist/. "$release_dir/server/public/"
cp .env.example "$release_dir/.env.example"

cat > "$release_dir/BUILD_INFO" <<EOF
commit_sha=${sha}
built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gate=G01
web_document_root=server/public
php_runtime=server/public/tinv-runtime
deploy_mode=direct-ftps-no-artifact
EOF

echo "Prepared shared-host release at $release_dir"
