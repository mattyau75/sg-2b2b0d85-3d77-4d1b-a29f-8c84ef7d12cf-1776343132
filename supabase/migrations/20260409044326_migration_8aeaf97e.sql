-- Add columns to store visually detected colors
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS detected_home_color TEXT,
ADD COLUMN IF NOT EXISTS detected_away_color TEXT;