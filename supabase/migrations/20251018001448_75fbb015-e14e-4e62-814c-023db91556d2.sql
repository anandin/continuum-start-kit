-- 1. Add engagement_id FK to progress_indicators for direct relationship
ALTER TABLE public.progress_indicators
ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES public.engagements(id) ON DELETE CASCADE;

-- Backfill engagement_id from session relationships
UPDATE public.progress_indicators pi
SET engagement_id = s.engagement_id
FROM public.sessions s
WHERE pi.session_id = s.id
  AND pi.engagement_id IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_progress_indicators_engagement_id 
ON public.progress_indicators(engagement_id);

-- 2. Ensure engagements have proper constraints (provider and seeker must be different)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'engagements_different_users_check'
    ) THEN
        ALTER TABLE public.engagements
        ADD CONSTRAINT engagements_different_users_check 
        CHECK (provider_id != seeker_id);
    END IF;
END $$;

-- 3. Add updated_at trigger to engagements
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to engagements
ALTER TABLE public.engagements
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create trigger for engagements
DROP TRIGGER IF EXISTS update_engagements_updated_at ON public.engagements;
CREATE TRIGGER update_engagements_updated_at
    BEFORE UPDATE ON public.engagements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_engagement_id 
ON public.sessions(engagement_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status 
ON public.sessions(status);

CREATE INDEX IF NOT EXISTS idx_messages_session_id_created_at 
ON public.messages(session_id, created_at DESC);

-- 5. Ensure seekers owner_id is not null (with safe migration)
DO $$ 
BEGIN
    -- First check if there are any NULL owner_ids
    IF EXISTS (SELECT 1 FROM public.seekers WHERE owner_id IS NULL) THEN
        RAISE NOTICE 'Warning: Found seekers with NULL owner_id - please fix data before setting NOT NULL constraint';
    ELSE
        -- Safe to add NOT NULL constraint
        ALTER TABLE public.seekers
        ALTER COLUMN owner_id SET NOT NULL;
    END IF;
END $$;