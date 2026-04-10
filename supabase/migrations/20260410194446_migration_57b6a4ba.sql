-- Ensure ai_player_mappings supports detected metadata
ALTER TABLE ai_player_mappings 
ADD COLUMN IF NOT EXISTS detected_number TEXT,
ADD COLUMN IF NOT EXISTS detected_team_side TEXT, -- 'home' or 'away'
ADD COLUMN IF NOT EXISTS ai_track_id TEXT,
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_manual_match BOOLEAN DEFAULT FALSE;

-- Create policy for the dashboard to update mappings
CREATE POLICY "Allow authenticated mapping updates" ON ai_player_mappings 
FOR UPDATE USING (true);