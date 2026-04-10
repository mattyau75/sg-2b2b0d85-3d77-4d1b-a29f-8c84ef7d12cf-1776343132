CREATE TABLE IF NOT EXISTS ai_player_mappings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      game_id UUID REFERENCES games(id) ON DELETE CASCADE,
      ai_detected_id TEXT NOT NULL,
      jersey_number INTEGER,
      team_side TEXT CHECK (team_side IN ('home', 'away')),
      real_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
      confidence NUMERIC(4,3),
      is_manual_override BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE ai_player_mappings ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public Read Mappings" ON ai_player_mappings FOR SELECT USING (true);
    CREATE POLICY "Public Insert Mappings" ON ai_player_mappings FOR INSERT WITH CHECK (true);
    CREATE POLICY "Public Update Mappings" ON ai_player_mappings FOR UPDATE USING (true);