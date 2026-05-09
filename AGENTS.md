# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Haven is a mental health / therapy platform with an AI "Therapist Twin" system. The codebase is a pnpm workspace monorepo with these key artifacts:

| Service | Package | Dev Command | Port |
|---|---|---|---|
| API Server (Express 5) | `@workspace/api-server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| Haven Web (Vite + React) | `@workspace/haven-web` | `pnpm --filter @workspace/haven-web run dev` | 5000 |
| Haven Mobile (Expo) | `@workspace/haven-mobile` | `pnpm --filter @workspace/haven-mobile run dev` | — |

Shared libraries live under `lib/` (`@workspace/db`, `@workspace/api-spec`, `@workspace/api-zod`, `@workspace/api-client-react`).

### Key commands

See `replit.md` for the full command reference. Quick summary:

- **Typecheck**: `pnpm run typecheck` (libs + artifacts)
- **Build**: `pnpm run build`
- **API codegen**: `pnpm --filter @workspace/api-spec run codegen`
- **DB schema push**: `pnpm --filter @workspace/db run push`
- **Seed test accounts**: `DATABASE_URL="..." npx tsx artifacts/api-server/src/seed.ts`

### Environment variables required to run

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://ubuntu:password@localhost:5432/haven` |
| `PORT` | Yes (API server) | Set to `8080` for the API server |
| `PORT` | Yes (Haven Web) | Set to `5000` for the Vite dev server |
| `BASE_PATH` | Yes (Haven Web) | Set to `/` for local dev |
| `SESSION_SECRET` | Recommended | Express session secret; has a fallback default |
| `OPENROUTER_API_KEY` | For AI features | Required to use LLM chat/classification |
| `OPENAI_API_KEY` | Optional | Embeddings, Whisper, TTS, moderation |

### Dev environment gotchas

1. **pnpm hoisting**: This repo was built on Replit which uses hoisted `node_modules`. The `.npmrc` must contain `node-linker=hoisted` for cross-package resolution to work (especially `zod/v4` imports in the api-server esbuild bundle).

2. **Vite proxy for API**: The Haven Web frontend uses relative `/api/` URLs. In local dev (where frontend and backend run on different ports), the Vite config includes a proxy rule that forwards `/api` requests to `http://localhost:8080`. This is already configured in `vite.config.ts`.

3. **PostgreSQL + pgvector**: The database requires PostgreSQL 16+ with the `vector` extension. The `pnpm --filter @workspace/db run push` command runs `ensure-extensions.mjs` automatically to create the extension before pushing the Drizzle schema.

4. **API server build step**: The `dev` script for `@workspace/api-server` runs `esbuild` to bundle, then starts the bundled output. It is NOT a watch/hot-reload setup — after code changes, you must restart the dev command.

5. **Test accounts**: After pushing the schema, run the seed script to create test accounts:
   - Provider: `coach@haven.test` / `test1234`
   - Seeker: `seeker@haven.test` / `test1234`

6. **Pre-existing type errors**: The repo has some pre-existing TypeScript errors (Express `req.query` type mismatches, calendar component API). The esbuild bundler does not type-check, so the API server builds and runs fine.

### Starting services (in order)

1. Start PostgreSQL: `sudo pg_ctlcluster 16 main start`
2. Start API server: `DATABASE_URL="postgresql://ubuntu:password@localhost:5432/haven" PORT=8080 SESSION_SECRET="dev-secret" pnpm --filter @workspace/api-server run dev`
3. Start Haven Web: `PORT=5000 BASE_PATH="/" pnpm --filter @workspace/haven-web run dev`
