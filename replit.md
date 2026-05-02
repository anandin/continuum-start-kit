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

Therapist Twin tables: safety_events, agent_versions, persona_examples, calibration_sessions,
client_memory (uses pgvector for optional semantic retrieval; falls back to recency + tag scoring
when embeddings are absent).

## Therapist Twin Architecture

Three-layer system enforced server-side in `artifacts/api-server/src/services/`:
- **L1 Constitutional Safety** (`safety.ts`): Hardcoded identity ("not a licensed therapist"), regex
  pre-screen + LLM classifier, templated crisis responses (CRISIS_TEMPLATE_US, SOFT_REDIRECT_TEMPLATE,
  HARMFUL_REQUEST_TEMPLATE). Every input AND output passes through `checkInput`/`checkOutput`. Audit
  fail-closed: persist throws on non-allow audit-write failure; orchestrator returns hardcoded template.
  `withConstitution()` prepends identity to every system prompt non-overridably.
- **L2 Persona** (`persona.ts`): Compiles system prompt from providerAgentConfig + providerConfig +
  top-K persona_examples (vector or tag-overlap retrieval).
- **L3 Client Memory** (`memory.ts`): Per-engagement structured memory written via `reflectAndWrite`
  on session finish; therapist can redact via UI; redacted entries excluded from retrieval.

Orchestration in `services/twinChat.ts:runTwinTurn()`. Calibration synthetic-client text also routes
through L1 output gate (defense-in-depth).

Therapist control tower pages in `artifacts/haven-web/src/pages/twin/`: Calibration.tsx,
PersonaLibrary.tsx, MemoryInspector.tsx, AuditLog.tsx — linked from ProviderDashboardView.

## Authorization

All engagement/session-scoped routes use `assertEngagementMember` or `assertSessionMember` helpers
in routes.ts (provider OR seeker.ownerId). Twin endpoints (memory delete, persona-examples delete)
also enforce object ownership.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
