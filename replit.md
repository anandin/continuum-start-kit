# Bloom Coaching Platform (Haven)

## Overview
Haven is an AI-powered coaching platform connecting providers (coaches) with seekers (clients). Providers configure their coaching methodology and AI agent personality, while seekers engage in AI-assisted coaching sessions.

## Architecture

### Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon/Replit) with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **AI**: OpenRouter API for AI chat completions

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
│   ├── pages/        # Page components
│   ├── components/   # UI components
│   ├── contexts/     # React contexts (AuthContext)
│   ├── hooks/        # Custom hooks
│   └── lib/          # Utilities
└── supabase/         # Legacy Supabase files (can be removed)
```

### Database Schema
- **users**: Authentication users
- **profiles**: User profile information
- **user_roles**: Provider or Seeker role
- **provider_configs**: Provider's coaching program configuration
- **provider_agent_configs**: AI agent personality settings
- **seekers**: Seeker records
- **engagements**: Provider-Seeker relationships
- **sessions**: Coaching sessions
- **messages**: Chat messages
- **summaries**: AI-generated session summaries
- **progress_indicators**: Session progress tracking

## Running the Project

```bash
npm run dev       # Start development server
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
- `GET /api/provider-configs` - List all provider configs
- `GET /api/provider-config` - Get current user's config
- `POST /api/provider-config` - Create/update config
- `GET /api/provider-agent-config` - Get agent config
- `POST /api/provider-agent-config` - Create/update agent config

### Engagements & Sessions
- `GET /api/engagements` - List user's engagements
- `POST /api/engagements` - Create new engagement
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions` - Create new session
- `POST /api/chat` - Send chat message
- `POST /api/sessions/:id/finish` - End session with AI summary

## Migration Notes

This project was migrated from Lovable/Supabase to Replit. Key changes:
1. Express backend replaces Supabase Edge Functions
2. PostgreSQL with Drizzle ORM replaces Supabase Database
3. Passport.js session auth replaces Supabase Auth
4. OpenRouter API replaces Lovable AI Gateway

The frontend still has some Supabase references that can be migrated incrementally.
