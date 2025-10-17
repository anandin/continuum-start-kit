-- Allow seekers to view all provider configs (so they can choose coaches)
CREATE POLICY "Anyone can view provider configs" 
ON public.provider_configs 
FOR SELECT 
USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "providers own configs" ON public.provider_configs;

-- Re-create the update/insert/delete policy for providers only
CREATE POLICY "Providers can manage their own configs" 
ON public.provider_configs 
FOR ALL 
USING (provider_id = auth.uid())
WITH CHECK (provider_id = auth.uid());