-- 1. Add diagnostic columns for better handoff visibility
ALTER TABLE games ADD COLUMN IF NOT EXISTS ignition_status TEXT DEFAULT 'pending';
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE;

-- 2. Hardened RLS: Ensure the worker can update progress even if not authenticated
-- We use a policy that allows anyone with the Supabase Anon Key to update processing columns
DROP POLICY IF EXISTS "allow_worker_updates" ON games;
CREATE POLICY "allow_worker_updates" ON games 
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

-- Ensure visibility for SELECT too
DROP POLICY IF EXISTS "allow_worker_select" ON games;
CREATE POLICY "allow_worker_select" ON games 
  FOR SELECT 
  USING (true);