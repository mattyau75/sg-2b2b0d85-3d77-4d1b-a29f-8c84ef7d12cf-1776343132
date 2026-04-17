-- Add plus_minus to box_scores table for individual player tracking
ALTER TABLE box_scores ADD COLUMN IF NOT EXISTS plus_minus integer DEFAULT 0;

-- Add steals and blocks to lineup_stats for defensive lineup metrics
ALTER TABLE lineup_stats ADD COLUMN IF NOT EXISTS steals integer DEFAULT 0;
ALTER TABLE lineup_stats ADD COLUMN IF NOT EXISTS blocks integer DEFAULT 0;