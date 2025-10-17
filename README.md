# Continuum

A production-ready React application with role-based authentication built with Lovable Cloud.

## 🚀 Features

- **Email Magic Link Authentication** - Secure, passwordless login via email
- **Role-Based Access Control** - Users choose between Provider and Seeker roles
- **Protected Routes** - Automatic redirect for unauthenticated users
- **Health Monitoring** - Frontend and backend health check endpoints
- **Production Ready** - Built with TypeScript, React 18, Vite, and Lovable Cloud

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Routing**: React Router v6
- **Backend**: Lovable Cloud (Supabase Edge Functions)
- **Database**: PostgreSQL (via Lovable Cloud)
- **Authentication**: Supabase Auth
- **State Management**: React Query

## 📋 Prerequisites

- Node.js 18+ and npm installed ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A Lovable account with Cloud enabled

## 🔧 Local Development Setup

### 1. Clone the repository

```sh
git clone <YOUR_GIT_URL>
cd continuum
```

### 2. Install dependencies

```sh
npm install
```

### 3. Environment Variables

The following environment variables are automatically configured by Lovable Cloud:

#### Client-Safe Variables (available in browser)
These variables are prefixed with `VITE_` and are safe to expose to the client:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key (public API key)
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (legacy, use PUBLISHABLE_KEY)
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

#### Server-Only Variables (Edge Functions only)
These secrets are only available in Edge Functions and must **never** be exposed to the client:

- `SUPABASE_URL` - Supabase project URL (server-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations (bypasses RLS)
- `SUPABASE_DB_URL` - Direct database connection URL
- `LOVABLE_API_KEY` - API key for Lovable AI Gateway (auto-provisioned)
- `CRON_SECRET` - Bearer token for protecting cron endpoints

#### Important Notes

✅ **Auto-Provisioned**: All environment variables are automatically injected by Lovable Cloud
⚠️ **Never Commit**: These should **never** be committed to version control
🔒 **Security**: Server-only secrets give full admin access - keep them secure
📝 **Custom Secrets**: Add custom secrets via Lovable dashboard under Settings → Secrets

### 4. Start the development server

```sh
npm run dev
```

The app will be available at `http://localhost:8080`

## 🗄️ Database Schema

### Profiles Table

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role, -- 'provider' | 'seeker'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only read their own profile
- Users can only update their own profile
- Profiles are auto-created on user signup

## 🌐 Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Marketing landing page |
| `/auth` | Public | Email magic link authentication |
| `/auth/role` | Protected | Role selection (provider/seeker) |
| `/dashboard` | Protected | Role-aware dashboard |
| `/provider/dashboard` | Protected (Provider) | Provider engagements overview |
| `/provider/engagement/:id` | Protected (Provider) | Detailed engagement history |
| `/onboarding` | Protected (Seeker) | Seeker onboarding flow |
| `/chat/:sessionId` | Protected | Real-time chat session |
| `/session/:sessionId/summary` | Protected | Session summary and insights |
| `/health` | Public | System health status page |

## 🔌 Edge Functions

All Edge Functions are deployed automatically with Lovable Cloud. They run on Deno runtime.

| Function | Endpoint | Auth | Description |
|----------|----------|------|-------------|
| `health` | `/functions/v1/health` | None | Health check for monitoring |
| `onboarding-assign` | `/functions/v1/onboarding-assign` | JWT | Creates engagement and first session |
| `chat-reply` | `/functions/v1/chat-reply` | JWT | Streams AI responses via Gemini |
| `trajectory-check` | `/functions/v1/trajectory-check` | JWT | Detects conversation patterns |
| `session-finish` | `/functions/v1/session-finish` | JWT | Generates session summaries |
| `cron-backfill` | `/functions/v1/cron-backfill` | Bearer Token | Backfills missing summaries |

**Note:** JWT = Requires valid Supabase authentication token; Bearer Token = Requires `CRON_SECRET`

## 🔐 Authentication Flow

1. User visits `/auth` and enters email
2. Magic link is sent to email (auto-confirmed in development)
3. User clicks link and is authenticated
4. If no role is set, user is redirected to `/auth/role`
5. User selects role (provider or seeker)
6. User is redirected to `/dashboard`

## 🏥 Health Checks

### Frontend Health Check
- **Route**: `/health`
- **Method**: Browser visit
- **Response**: Visual health status page showing system status

### Backend Health Check
- **Endpoint**: `https://wrsetdouqzkznyrmassr.supabase.co/functions/v1/health`
- **Method**: GET
- **Authentication**: None (public endpoint)
- **Response**: `{ "ok": true, "timestamp": "2025-01-01T00:00:00.000Z" }`
- **Use Case**: Uptime monitoring, load balancer health checks

## ⏰ Cron Jobs & Background Tasks

### Backfill Cron Job

The `cron-backfill` Edge Function runs periodically to generate summaries for sessions that ended without summaries.

**Endpoint:** `https://wrsetdouqzkznyrmassr.supabase.co/functions/v1/cron-backfill`

**Authentication:** Requires `Authorization: Bearer ${CRON_SECRET}` header

**What it does:**
1. Finds all sessions with `status='ended'` but no `summaries` row
2. Loads full conversation transcript and provider configuration
3. Calls Gemini AI to generate comprehensive session summary
4. Inserts summary with assigned stage, key insights, sentiment score, and trajectory status

**Response:**
```json
{
  "success": true,
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "errors": ["Session abc: No provider config found"]
}
```

### Setting Up Cron Schedule

**Option 1: Lovable Cloud (Recommended)**
Lovable Cloud can schedule cron jobs directly. Contact support to enable scheduled execution.

**Option 2: External Cron Service**
Use a service like [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com/), or [GitHub Actions](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule):

```yaml
# .github/workflows/cron-backfill.yml
name: Cron Backfill
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
jobs:
  backfill:
    runs-on: ubuntu-latest
    steps:
      - name: Call backfill endpoint
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://wrsetdouqzkznyrmassr.supabase.co/functions/v1/cron-backfill
```

**Option 3: Supabase pg_cron**
For self-hosted Supabase, use `pg_cron` extension:

```sql
SELECT cron.schedule(
  'session-backfill',
  '0 */6 * * *',  -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://wrsetdouqzkznyrmassr.supabase.co/functions/v1/cron-backfill',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    )
  );
  $$
);
```

### Security Note

🔒 The `CRON_SECRET` is a critical security token. Keep it secure and never commit it to version control. Rotate it periodically via Lovable dashboard Settings → Secrets.

## 🚀 Deployment

This project is configured for deployment to **Lovable Cloud** (primary), **Vercel**, or **Netlify**.

### Deploy with Lovable Cloud (Recommended)

Lovable Cloud provides the full backend infrastructure including database, authentication, and Edge Functions.

1. Open your project in [Lovable](https://lovable.dev)
2. Click "Publish" in the top right
3. Your app will be deployed automatically with all backend services

**Advantages:**
- ✅ Zero configuration - everything works out of the box
- ✅ Automatic Edge Function deployment
- ✅ Built-in database and authentication
- ✅ Automatic environment variable injection
- ✅ Real-time preview URLs

### Deploy to Vercel

Vercel can host the frontend, but you'll need to configure Supabase separately for backend.

1. **Install Vercel CLI:**
   ```sh
   npm i -g vercel
   ```

2. **Set Environment Variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

3. **Deploy:**
   ```sh
   vercel
   ```

4. **Configure Supabase Edge Functions** separately (not auto-deployed by Vercel)

**Configuration:** `vercel.json` is included for SPA routing and asset caching.

### Deploy to Netlify

Netlify can host the frontend, but you'll need to configure Supabase separately for backend.

1. **Set Environment Variables** in Netlify dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`

2. **Deploy via Git:**
   - Connect your repository to Netlify
   - Netlify will automatically detect build settings from `netlify.toml`

3. **Configure Supabase Edge Functions** separately (not auto-deployed by Netlify)

**Configuration:** `netlify.toml` is included for SPA routing and asset caching.

### Backend Requirements for Non-Lovable Deployments

If deploying to Vercel or Netlify, you'll need to:

1. **Set up a Supabase project** at [supabase.com](https://supabase.com)
2. **Deploy Edge Functions manually** using Supabase CLI:
   ```sh
   npx supabase functions deploy
   ```
3. **Configure secrets** in Supabase dashboard (Settings → Edge Functions → Secrets):
   - `LOVABLE_API_KEY` (for AI features)
   - `CRON_SECRET` (for scheduled tasks)
4. **Set up cron jobs** for background tasks (see Cron Jobs section below)

## 🔒 Security Best Practices

✅ **Implemented**:
- RLS policies on all database tables
- Server-only secrets never exposed to client
- Email confirmation for authentication
- Protected routes with automatic redirect
- TypeScript for type safety

⚠️ **Important**:
- Never commit `.env` files
- Always use `VITE_` prefix for client-safe variables
- Server secrets should only be accessed in Edge Functions
- Validate all user inputs on both client and server

## 📁 Project Structure

```
continuum/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   └── ProtectedRoute.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx  # Authentication state
│   ├── integrations/
│   │   └── supabase/        # Auto-generated Supabase client
│   ├── pages/
│   │   ├── Landing.tsx           # Marketing page
│   │   ├── Auth.tsx              # Login page
│   │   ├── RolePicker.tsx        # Role selection
│   │   ├── Dashboard.tsx         # Main dashboard
│   │   ├── ProviderDashboard.tsx # Provider engagements
│   │   ├── ProviderEngagement.tsx # Engagement details
│   │   ├── ProviderSetup.tsx     # Provider configuration
│   │   ├── Onboarding.tsx        # Seeker onboarding
│   │   ├── Chat.tsx              # Real-time chat
│   │   ├── SessionSummary.tsx    # Session insights
│   │   ├── Health.tsx            # Health check page
│   │   └── NotFound.tsx          # 404 page
│   ├── App.tsx              # Route configuration
│   └── index.css            # Global styles
├── supabase/
│   ├── functions/
│   │   ├── health/               # Health check endpoint
│   │   ├── onboarding-assign/    # Create engagement
│   │   ├── chat-reply/           # AI chat streaming
│   │   ├── trajectory-check/     # Pattern detection
│   │   ├── session-finish/       # Generate summaries
│   │   └── cron-backfill/        # Backfill missing summaries
│   ├── migrations/               # Database schema
│   └── config.toml               # Supabase configuration
├── vercel.json              # Vercel deployment config
├── netlify.toml             # Netlify deployment config
└── README.md
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Visit landing page at `/`
- [ ] Click "Get Started" and reach `/auth`
- [ ] Enter email and receive magic link
- [ ] Click magic link and authenticate
- [ ] Redirected to `/auth/role` for role selection
- [ ] Select a role (provider or seeker)
- [ ] Redirected to `/dashboard`
- [ ] Dashboard shows correct role
- [ ] Visit `/health` and verify all services are operational
- [ ] Sign out redirects to `/auth`
- [ ] Unauthenticated access to `/dashboard` redirects to `/auth`

## 🆘 Troubleshooting

### "Failed to send magic link"
- Ensure email confirmation is enabled in Lovable Cloud settings
- Check that auto-confirm is enabled for development

### "Backend health check failing"
- Verify edge function is deployed
- Check Cloud function logs in Lovable dashboard
- Ensure `verify_jwt = false` is set for health function in `config.toml`

### "Not redirected after login"
- Clear browser cache and cookies
- Check browser console for errors
- Verify `emailRedirectTo` is set correctly

## 📚 Additional Resources

- [Lovable Documentation](https://docs.lovable.dev/)
- [Lovable Cloud Features](https://docs.lovable.dev/features/cloud)
- [React Router Docs](https://reactrouter.com/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

## 📄 License

This project is built with Lovable and is licensed under your chosen license.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ using [Lovable](https://lovable.dev)
