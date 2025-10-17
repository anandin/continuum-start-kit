-- Drop existing profiles table and dependencies
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS handle_profiles_updated_at ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_updated_at();
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.user_role;

-- Core profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('provider','seeker')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider program/config
CREATE TABLE IF NOT EXISTS public.provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  methodology TEXT,
  stages JSONB NOT NULL,
  labels JSONB DEFAULT '[]'::JSONB,
  summary_template JSONB DEFAULT '[]'::JSONB,
  tagging_rules JSONB DEFAULT '[]'::JSONB,
  trajectory_rules JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seekers + engagements
CREATE TABLE IF NOT EXISTS public.seekers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE public.engagement_status AS ENUM ('active','paused','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id UUID REFERENCES public.seekers(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.engagement_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions + messages
DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('active','ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id UUID REFERENCES public.engagements(id) ON DELETE CASCADE,
  status public.session_status DEFAULT 'active',
  initial_stage TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

DO $$ BEGIN
  CREATE TYPE public.msg_role AS ENUM ('seeker','agent','provider');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  role public.msg_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Summaries + progress indicators
CREATE TABLE IF NOT EXISTS public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  assigned_stage TEXT,
  session_summary TEXT,
  key_insights JSONB DEFAULT '[]'::JSONB,
  next_action TEXT,
  trajectory_status TEXT CHECK (trajectory_status IN ('steady','drifting','stalling','accelerating')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.progress_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('drift','leap','stall','steady')),
  detail JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_engagement_started ON public.sessions(engagement_id, started_at);
CREATE INDEX IF NOT EXISTS idx_summaries_session_created ON public.summaries(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_indicators_session_created ON public.progress_indicators(session_id, created_at);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seekers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "profiles self" ON public.profiles 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "providers own configs" ON public.provider_configs
  FOR ALL USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

CREATE POLICY "seekers self" ON public.seekers
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "engagements scoped" ON public.engagements
  FOR ALL USING (
    provider_id = auth.uid()
    OR EXISTS(SELECT 1 FROM public.seekers s WHERE s.id = engagements.seeker_id AND s.owner_id = auth.uid())
  ) WITH CHECK (true);

CREATE POLICY "sessions scoped" ON public.sessions
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM public.engagements e
      JOIN public.seekers s ON s.id = e.seeker_id
      WHERE e.id = sessions.engagement_id
        AND (e.provider_id = auth.uid() OR s.owner_id = auth.uid())
    )
  ) WITH CHECK (true);

CREATE POLICY "messages scoped" ON public.messages
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM public.sessions ss
      JOIN public.engagements e ON e.id = ss.engagement_id
      JOIN public.seekers s ON s.id = e.seeker_id
      WHERE messages.session_id = ss.id
        AND (e.provider_id = auth.uid() OR s.owner_id = auth.uid())
    )
  ) WITH CHECK (true);

CREATE POLICY "summaries scoped" ON public.summaries
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM public.sessions ss
      JOIN public.engagements e ON e.id = ss.engagement_id
      JOIN public.seekers s ON s.id = e.seeker_id
      WHERE summaries.session_id = ss.id
        AND (e.provider_id = auth.uid() OR s.owner_id = auth.uid())
    )
  ) WITH CHECK (true);

CREATE POLICY "indicators scoped" ON public.progress_indicators
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM public.sessions ss
      JOIN public.engagements e ON e.id = ss.engagement_id
      JOIN public.seekers s ON s.id = e.seeker_id
      WHERE progress_indicators.session_id = ss.id
        AND (e.provider_id = auth.uid() OR s.owner_id = auth.uid())
    )
  ) WITH CHECK (true);