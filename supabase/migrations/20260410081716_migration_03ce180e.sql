-- FIX: Consolidate RLS policies for the games table to ensure the worker has visibility and update rights
DROP POLICY IF EXISTS "public_select_games" ON games;
DROP POLICY IF EXISTS "public_update_games" ON games;

-- Allow reading the game row to confirm it exists
CREATE POLICY "worker_read_games" ON games 
FOR SELECT 
TO public 
USING (true);

-- Allow updating the progress and logs
CREATE POLICY "worker_update_games" ON games 
FOR UPDATE 
TO public 
USING (true)
WITH CHECK (true);