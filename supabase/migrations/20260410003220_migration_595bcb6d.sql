-- Add missing team_id column for easier filtering in mapping views
ALTER TABLE player_game_stats ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Ensure RLS is updated for the new column (though already handled by broad anon policies)
-- The unique constraint 'player_game_stats_game_id_player_id_key' already exists, which is perfect for upsert.