# Haven (Bloom Coaching Platform)

## Overview
Haven is an AI-powered coaching platform connecting providers (coaches) with seekers (clients). Providers configure their coaching methodology and AI agent personality, while seekers engage in AI-assisted coaching sessions.

## Architecture

### Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon/Replit) with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **AI**: OpenRouter API for AI chat completions

### Design System
- **Philosophy**: IDEO human-centered design — empathy-driven, warm, progressive disclosure
- **Primary**: Warm teal (174 55% 36%) — growth, healing, nature
- **Accent**: Warm amber (38 75% 59%) — warmth, welcome
- **Background**: Warm off-white (40 33% 98%) — comfort
- **Text**: Rich charcoal (30 15% 20%) — readable warmth
- **Radius**: 1rem (soft, friendly)
- **Shadows**: Warm-toned (`shadow-warm` utility)
- **Gradients**: `bg-gradient-warm-hero`, `bg-gradient-warm-card`
- **Animations**: `animate-fade-in`

### Project Structure
```
/
├── server/           # Express backend
│   ├── index.ts      # Main server entry
│   ├── auth.ts       # Authentication (Passport.js)
│   ├── routes.ts     # API routes
│   ├── storage.ts    # Database access layer
│   ├── db.ts         # Drizzle database connection
│   └── vite.ts       # Vite dev server integration
├── shared/
│   └── schema.ts     # Drizzle schema definitions
├── src/              # React frontend
│   ├── pages/        # Page components (Landing, Auth, Dashboard, Chat, etc.)
│   ├── components/   # UI components (dashboard views, TrajectoryChip, etc.)
│   ├── contexts/     # React contexts (AuthContext)
│   ├── hooks/        # Custom hooks (useEngagements, use-toast)
│   └── lib/          # Utilities (queryClient)
├── tailwind.config.ts
└── src/index.css     # Design system CSS variables
```

### Database Schema
- **users / profiles / user_roles**: Auth & roles (provider or seeker)
- **provider_configs**: Coaching program (title, methodology, stages, rules)
- **provider_agent_configs**: AI agent personality (identity, tone, voice, rules)
- **seekers / engagements / sessions / messages / summaries / progress_indicators**: Coaching engagements & session data
- **client_notes**: Private provider notes per engagement (optionally tied to a session)
- **goals**: Action items (active / completed / paused, optional due date)
- **intake_forms / intake_responses**: Provider-built intake questionnaires & seeker responses
- **resources / resource_assignments**: Resource library + per-engagement assignments
- **alerts**: Inactivity, trajectory change, overdue goal, new intake notifications
- **provider_onboarding_chats**: Conversational AI setup transcripts + generated configs

### Test Accounts
- Coach: `coach@haven.test` / `test1234`
- Seeker: `seeker@haven.test` / `test1234`
- Test Provider ID: `573ac609-2ca1-4af4-90d5-db34d1446541`

## Running the Project

```bash
npm run dev       # Start development server (Express + Vite)
npm run build     # Build for production
npm run db:push   # Push schema changes to database
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `OPENROUTER_API_KEY` - OpenRouter API key for AI chat
- `SESSION_SECRET` - Session encryption secret (optional, has default)

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/session` - Get current session

### User
- `GET /api/user/profile` - Get user profile and role
- `POST /api/user/role` - Set user role (provider/seeker)

### Provider
- `GET /api/provider-configs` - List all provider configs (for onboarding)
- `GET /api/provider-config` - Get current user's config
- `POST /api/provider-config` - Create/update config
- `GET /api/provider-agent-config` - Get agent config
- `POST /api/provider-agent-config` - Create/update agent config

### Engagements & Sessions
- `GET /api/engagements` - List user's engagements
- `POST /api/engagements` - Create new engagement
- `GET /api/engagements/:id` - Get engagement details
- `GET /api/engagements/:id/sessions` - Get sessions for engagement
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions/:id/messages` - Get session messages
- `GET /api/sessions/:id/summary` - Get session summary
- `POST /api/sessions` - Create new session
- `POST /api/chat` - Send chat message
- `POST /api/sessions/:id/finish` - End session with AI summary
- `POST /api/onboarding-assign` - Assign seeker during onboarding

## Key Frontend Pages
- **Landing** (`/`): Warm hero with "For Individuals" / "For Experts" toggle
- **Auth** (`/auth`): Sign in / sign up with autofill-friendly fields
- **RolePicker** (`/auth/role`): Choose provider or seeker role
- **Dashboard** (`/dashboard`): Role-based view wrapped in AppLayout (sidebar + alerts bell for providers)
- **Onboarding** (`/onboarding`): Multi-step seeker onboarding with provider selection
- **Chat** (`/chat/:sessionId`): Real-time AI coaching conversation
- **SessionSummary** (`/session-summary/:sessionId`): Post-session insights for seekers
- **ProviderOnboarding** (`/provider/onboarding`): **Conversational AI setup** — Haven interviews the provider and auto-generates the full provider + agent config; replaces the old form-heavy setup as the primary path
- **ProviderSetup** (`/provider/setup`): Advanced settings editor (CTA at top to re-run setup chat)
- **AgentSetup** (`/provider/agent-setup`): Advanced agent personality editor
- **Schedule** (`/provider/schedule`): Recent sessions, inactive clients, overdue goals at a glance
- **Resources** (`/provider/resources`): Resource library (links / exercises / docs) with per-client assignment
- **IntakeForms** (`/provider/intake-forms`): Build intake questionnaires (text / multiple choice / scale)
- **Analytics** (`/provider/analytics`): Practice-wide insights — clients, sessions, stage & trajectory distribution
- **ProviderProfile** (`/coach/:providerId`): Public-facing shareable provider page (no auth)
- **ClientSessionSummary** (`/provider/client/:clientId`): Tabbed client view (Sessions, Notes, Goals, Resources, Intake)

### Reusable layout components
- **AppLayout** + **ProviderSidebar** + **AlertsBell** — consistent header/sidebar shell across provider screens
- **NotesPanel** — private notes per engagement (CRUD)
- **GoalsTracker** — goals with status/due-date/completion

## API Routes (additions)
- **Notes**: `GET/POST /api/engagements/:id/notes`, `PUT/DELETE /api/notes/:id`
- **Goals**: `GET/POST /api/engagements/:id/goals`, `PUT/DELETE /api/goals/:id`
- **Resources**: `GET/POST /api/resources`, `PUT/DELETE /api/resources/:id`, `POST /api/resources/:id/assign`, `GET /api/engagements/:id/resources`
- **Intake**: `GET/POST /api/intake-forms`, `GET /api/intake-forms/:id`, `POST /api/intake-responses`, `GET /api/engagements/:id/intake`
- **Alerts**: `GET /api/alerts`, `GET /api/alerts/unread-count`, `PUT /api/alerts/:id/read`. Auto-generated on session finish (trajectory drift/stall).
- **AI Onboarding**: `POST /api/provider-onboarding/chat` (chat turn), `POST /api/provider-onboarding/generate` (synthesize config), `POST /api/provider-onboarding/apply` (write to provider_configs + provider_agent_configs)
- **Analytics**: `GET /api/analytics/practice-overview`, `GET /api/analytics/client/:id/trends`
- **Schedule**: `GET /api/schedule/overview`
- **Public profile**: `GET /api/public/provider/:providerId`

## Migration Status
Fully migrated from Lovable/Supabase to Replit:
1. Express backend replaces Supabase Edge Functions
2. PostgreSQL with Drizzle ORM replaces Supabase Database
3. Passport.js session auth replaces Supabase Auth
4. OpenRouter API replaces Lovable AI Gateway
5. All Supabase client references removed — zero remaining imports
