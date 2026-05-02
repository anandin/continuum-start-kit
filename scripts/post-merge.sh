#!/bin/bash
# Runs after the platform merges a task agent's branch into main.
# Keep this script idempotent and side-effect minimal — it executes
# automatically without operator review.
set -e

pnpm install --frozen-lockfile

# Schema sync. We use the non-force `push` so destructive changes (drop
# columns / drop tables / rename detection ambiguities) require an
# operator to run `pnpm --filter @workspace/db run push-force` manually.
# Forcing on every merge in shared/dev environments would risk silent
# data loss when a task agent introduced an unintended drop.
pnpm --filter @workspace/db run push
