-- Add selected_model column to provider_agent_configs table
ALTER TABLE public.provider_agent_configs 
ADD COLUMN IF NOT EXISTS selected_model text DEFAULT 'google/gemini-2.5-flash';