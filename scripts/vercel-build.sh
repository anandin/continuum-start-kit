#!/bin/bash
set -ex

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO_ROOT"
pnpm --filter @workspace/api-server run build

cd "$REPO_ROOT/artifacts/haven-web"
PORT=3000 BASE_PATH=/ npx vite build --config vite.config.ts

cp -r "$REPO_ROOT/artifacts/haven-web/dist/public" "$REPO_ROOT/_site"
