-- 1. Unlocking RLS Visibility: Allow public/worker to SELECT the game row so they can UPDATE it
DROP POLICY IF EXISTS "worker_read_games" ON games;
CREATE POLICY "worker_read_games" ON games FOR SELECT TO public USING (true);

-- 2. Consolidate Update Policy
DROP POLICY IF EXISTS "worker_update_games" ON games;
CREATE POLICY "worker_update_games" ON games FOR UPDATE TO public USING (true) WITH CHECK (true);