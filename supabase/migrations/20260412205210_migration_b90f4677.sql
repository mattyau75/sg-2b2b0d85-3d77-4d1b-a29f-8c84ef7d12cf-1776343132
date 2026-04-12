-- 1. ENABLE REALTIME FOR THE TRACE TABLE
ALTER publication supabase_realtime ADD TABLE game_analysis;

-- 2. ENSURE PUBLIC READ ACCESS FOR THE TRACE (T2 Policy)
ALTER TABLE game_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_trace" ON game_analysis;
CREATE POLICY "public_read_trace" ON game_analysis FOR SELECT USING (true);

-- 3. ENSURE SERVICE ROLE CAN WRITE (Default)
DROP POLICY IF EXISTS "service_role_write" ON game_analysis;
CREATE POLICY "service_role_write" ON game_analysis FOR ALL USING (true);