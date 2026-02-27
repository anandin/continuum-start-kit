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
- **users**: Authentication users
- **profiles**: User profile information
- **user_roles**: Provider or Seeker role
- **provider_configs**: Provider's coaching program configuration
- **provider_agent_configs**: AI agent personality settings (core_identity, guiding_principles, tone, voice, rules, boundaries, provider_name, provider_title, avatar_url, selected_model)
- **seekers**: Seeker records
- **engagements**: Provider-Seeker relationships
- **sessions**: Coaching sessions
- **messages**: Chat messages
- **summaries**: AI-generated session summaries
- **progress_indicators**: Session progress tracking

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
- **Auth** (`/auth`): Sign in / sign up with "Welcome Back" / "Get Started" tabs
- **RolePicker** (`/auth/role`): Choose provider or seeker role
- **Dashboard** (`/dashboard`): Role-based view (SeekerDashboardView / ProviderDashboardView)
- **Onboarding** (`/onboarding`): Multi-step seeker onboarding with provider selection
- **Chat** (`/chat/:sessionId`): Real-time AI coaching conversation
- **SessionSummary** (`/session-summary/:sessionId`): Post-session insights
- **ProviderSetup** (`/provider/setup`): Provider coaching program configuration
- **AgentSetup** (`/provider/agent-setup`): AI agent personality configuration
- **ProviderEngagement** (`/provider/engagement/:engagementId`): Client session timeline
- **ClientSessionSummary** (`/provider/client/:clientId`): Provider's view of client progress

## Migration Status
Fully migrated from Lovable/Supabase to Replit:
1. Express backend replaces Supabase Edge Functions
2. PostgreSQL with Drizzle ORM replaces Supabase Database
3. Passport.js session auth replaces Supabase Auth
4. OpenRouter API replaces Lovable AI Gateway
5. All Supabase client references removed — zero remaining imports
