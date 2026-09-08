#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d dist ]]; then
  echo "dist/ is missing; run the frontend build first" >&2
  exit 1
fi

sha="${GITHUB_SHA:-local}"
out_dir="deploy-package"
release_dir="$out_dir/release"
archive="$out_dir/telegram-invoice-miniapp-${sha}.tar.gz"

rm -rf "$out_dir"
mkdir -p "$release_dir"

# Server application stays outside its own public document root.
cp -a server "$release_dir/server"
rm -f "$release_dir/server/.env"

# Compile frontend into the same-origin Apache document root while retaining
# index.php and .htaccess from server/public.
cp -a dist/. "$release_dir/server/public/"
cp .env.example "$release_dir/.env.example"

cat > "$release_dir/BUILD_INFO" <<EOF
commit_sha=${sha}
built_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gate=G01
web_document_root=server/public
EOF

tar -C "$release_dir" -czf "$archive" .

echo "Created $archive"
