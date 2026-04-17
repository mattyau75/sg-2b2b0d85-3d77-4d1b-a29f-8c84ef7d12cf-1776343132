-- Create optimized tables for Batch Migration
CREATE TABLE IF NOT EXISTS play_by_play (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  event_type TEXT NOT NULL, -- 'shot', 'rebound', 'assist', etc.
  timestamp_ms BIGINT NOT NULL,
  period INTEGER,
  x_coord DECIMAL,
  y_coord DECIMAL,
  is_made BOOLEAN,
  points INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS box_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  points INTEGER DEFAULT 0,
  rebounds INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  steals INTEGER DEFAULT 0,
  blocks INTEGER DEFAULT 0,
  turnovers INTEGER DEFAULT 0,
  fg_made INTEGER DEFAULT 0,
  fg_attempted INTEGER DEFAULT 0,
  three_pt_made INTEGER DEFAULT 0,
  three_pt_attempted INTEGER DEFAULT 0,
  ft_made INTEGER DEFAULT 0,
  ft_attempted INTEGER DEFAULT 0,
  minutes_played DECIMAL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- Enable RLS for Batch Migration (GPU Service Role)
ALTER TABLE play_by_play ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Service Role Inserts" ON play_by_play FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow Service Role Upserts" ON box_scores FOR ALL USING (true);
CREATE POLICY "Public Read" ON play_by_play FOR SELECT USING (true);
CREATE POLICY "Public Read" ON box_scores FOR SELECT USING (true);