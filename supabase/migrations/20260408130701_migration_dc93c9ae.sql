-- Allow anonymous team creation (Template T3)
DROP POLICY IF EXISTS "auth_write_teams" ON teams;
CREATE POLICY "anon_insert_teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_teams" ON teams FOR UPDATE USING (true);
CREATE POLICY "anon_delete_teams" ON teams FOR DELETE USING (true);

-- Allow anonymous player creation
DROP POLICY IF EXISTS "auth_write_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_players" ON players FOR UPDATE USING (true);
CREATE POLICY "anon_delete_players" ON players FOR DELETE USING (true);

-- Allow anonymous game creation
DROP POLICY IF EXISTS "auth_write_games" ON games;
CREATE POLICY "anon_insert_games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_games" ON games FOR UPDATE USING (true);
CREATE POLICY "anon_delete_games" ON games FOR DELETE USING (true);

-- Allow anonymous stat writing
DROP POLICY IF EXISTS "auth_write_stats" ON player_game_stats;
CREATE POLICY "anon_insert_stats" ON player_game_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_stats" ON player_game_stats FOR UPDATE USING (true);

-- Allow anonymous PBP writing
DROP POLICY IF EXISTS "auth_write_pbp" ON play_by_play;
CREATE POLICY "anon_insert_pbp" ON play_by_play FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_pbp" ON play_by_play FOR UPDATE USING (true);