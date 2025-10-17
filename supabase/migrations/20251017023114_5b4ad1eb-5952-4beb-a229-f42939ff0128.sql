-- Create provider_agent_configs table for AI agent configuration
CREATE TABLE IF NOT EXISTS public.provider_agent_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Agent identity
  core_identity text,
  guiding_principles text,
  
  -- Communication style
  tone text,
  voice text,
  rules text,
  boundaries text,
  
  -- Provider profile (optional)
  provider_name text,
  provider_title text,
  avatar_url text
);

-- Enable RLS
ALTER TABLE public.provider_agent_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Providers own their agent configs
CREATE POLICY "Providers own their agent configs"
ON public.provider_agent_configs
FOR ALL
TO authenticated
USING (provider_id = auth.uid())
WITH CHECK (provider_id = auth.uid());