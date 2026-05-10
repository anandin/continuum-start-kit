#!/bin/bash
set -e

cd /vercel/path0
pnpm --filter @workspace/api-server run build

cd /vercel/path0/artifacts/haven-web
PORT=3000 BASE_PATH=/ npx vite build --config vite.config.ts

cp -r /vercel/path0/artifacts/haven-web/dist/public /vercel/path0/_site
