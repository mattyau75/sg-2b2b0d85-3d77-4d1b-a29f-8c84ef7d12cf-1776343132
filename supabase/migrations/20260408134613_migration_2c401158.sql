-- Add score columns to games table to support cascading updates
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_score INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_score INTEGER DEFAULT 0;

-- Update types