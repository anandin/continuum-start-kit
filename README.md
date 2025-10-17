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

**Client-Safe Variables** (available in browser):
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

**Server-Only Variables** (Edge Functions only):
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_DB_URL` - Direct database connection URL

These are automatically injected by Lovable Cloud and should **never** be committed to version control.

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
| `/health` | Public | System health status page |

## 🔐 Authentication Flow

1. User visits `/auth` and enters email
2. Magic link is sent to email (auto-confirmed in development)
3. User clicks link and is authenticated
4. If no role is set, user is redirected to `/auth/role`
5. User selects role (provider or seeker)
6. User is redirected to `/dashboard`

## 🏥 Health Checks

### Frontend Health
- **Route**: `/health`
- **Method**: Browser visit
- **Response**: Visual health status page

### Backend Health
- **Endpoint**: Edge Function `/functions/v1/health`
- **Method**: GET
- **Response**: `{ "ok": true, "timestamp": "..." }`

## 🚀 Deployment

### Deploy with Lovable

1. Open your project in [Lovable](https://lovable.dev)
2. Click "Publish" in the top right
3. Your app will be deployed automatically

### Deploy to Vercel (Alternative)

```sh
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

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
│   │   ├── Landing.tsx      # Marketing page
│   │   ├── Auth.tsx         # Login page
│   │   ├── RolePicker.tsx   # Role selection
│   │   ├── Dashboard.tsx    # Main app
│   │   ├── Health.tsx       # Health check page
│   │   └── NotFound.tsx     # 404 page
│   ├── App.tsx              # Route configuration
│   └── index.css            # Global styles
├── supabase/
│   ├── functions/
│   │   └── health/          # Health check edge function
│   └── config.toml          # Supabase configuration
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
