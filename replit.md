# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Multi-artifact project: Haven web app + API server + shared libs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 + Passport.js (session auth)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS v3 + react-router-dom + react-query

## Artifacts

- `artifacts/haven-web` — Haven Web frontend (React + Vite, Tailwind v3). Preview at `/`
- `artifacts/api-server` — Express API server with Passport auth. Preview at `/api`
- `artifacts/mockup-sandbox` — Design canvas

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Auth

Uses Passport.js LocalStrategy with express-session + connect-pg-simple (session table: `user_sessions`).
Test accounts: `coach@haven.test` / `test1234` (provider) and `seeker@haven.test` / `test1234` (seeker).

## API

Routes defined in `artifacts/api-server/src/routes/routes.ts` using `registerRoutes(app: Express)` pattern.
Auth setup in `artifacts/api-server/src/auth.ts` using `setupAuth(app: Express)` pattern.
Both wired directly into `artifacts/api-server/src/app.ts`.

## Database Schema

Full schema at `lib/db/src/schema/schema.ts`. Tables: users, profiles, userRoles, seekers, providerConfigs,
providerAgentConfigs, engagements, sessions, messages, summaries, progressIndicators, clientNotes,
goals, intakeForms, intakeResponses, resources, resourceAssignments, alerts, providerOnboardingChats,
user_sessions (created manually for connect-pg-simple).

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
