-- Clean up and consolidate RLS policies for the games table to ensure the worker has access
DROP POLICY IF EXISTS "anon_update" ON games;
DROP POLICY IF EXISTS "anon_update_games" ON games;

CREATE POLICY "worker_update_progress" ON games 
FOR UPDATE 
TO public
USING (true)
WITH CHECK (true);

-- Ensure SELECT is also open so the worker can read existing metadata
DROP POLICY IF EXISTS "public_read_games" ON games;
CREATE POLICY "public_read_games" ON games 
FOR SELECT 
TO public
USING (true);