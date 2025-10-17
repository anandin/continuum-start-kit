-- First, delete duplicate roles, keeping only the first one for each user
DELETE FROM public.user_roles
WHERE id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS row_num
    FROM public.user_roles
  ) t
  WHERE row_num > 1
);

-- Drop the existing unique constraint that allows multiple roles per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Add a new unique constraint on user_id only (one role per user)
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);