-- FIX 1: Explicitly fix RLS on the games table to allow the worker to see and update rows
DROP POLICY IF EXISTS "worker_update_progress" ON games;
DROP POLICY IF EXISTS "public_read_games" ON games;
DROP POLICY IF EXISTS "anon_update_games" ON games;

-- Allow anyone (including worker) to see the game rows
CREATE POLICY "public_select_games" ON games FOR SELECT USING (true);

-- Allow anyone with the API key (including worker) to update progress and logs
CREATE POLICY "public_update_games" ON games FOR UPDATE USING (true) WITH CHECK (true);

-- FIX 2: Ensure the worker has access to rosters for detection
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_players" ON players;
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);