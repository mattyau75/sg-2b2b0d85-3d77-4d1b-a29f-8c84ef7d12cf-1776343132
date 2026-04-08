-- Create Lineup Stats table
CREATE TABLE lineup_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_ids UUID[] NOT NULL, -- Array of 5 player IDs
  minutes_played DECIMAL(5,2) DEFAULT 0,
  points_for INTEGER DEFAULT 0,
  points_against INTEGER DEFAULT 0,
  possessions INTEGER DEFAULT 0,
  fg_made INTEGER DEFAULT 0,
  fg_attempted INTEGER DEFAULT 0,
  three_pm INTEGER DEFAULT 0,
  three_pa INTEGER DEFAULT 0,
  rebounds INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  turnovers INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lineup_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_lineups" ON lineup_stats FOR SELECT USING (true);
CREATE POLICY "anon_insert_lineups" ON lineup_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_lineups" ON lineup_stats FOR UPDATE USING (true);