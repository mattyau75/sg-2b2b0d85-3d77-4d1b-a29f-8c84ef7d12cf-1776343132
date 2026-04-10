-- 1. Create a dedicated policy for the GPU Worker to report progress
-- This ensures the worker isn't blocked by 'Permission Denied' errors
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Allow the worker to see the game row
DROP POLICY IF EXISTS "worker_select_games" ON games;
CREATE POLICY "worker_select_games" ON games FOR SELECT USING (true);

-- Allow the worker to update progress and logs
DROP POLICY IF EXISTS "worker_update_games" ON games;
CREATE POLICY "worker_update_games" ON games FOR UPDATE USING (true) WITH CHECK (true);