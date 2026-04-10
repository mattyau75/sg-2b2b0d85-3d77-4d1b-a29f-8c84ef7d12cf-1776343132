-- Ensure the worker can see and update the games table
DROP POLICY IF EXISTS "public_select_games" ON games;
CREATE POLICY "public_select_games" ON games FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_update_games" ON games;
CREATE POLICY "public_update_games" ON games FOR UPDATE TO public USING (true) WITH CHECK (true);