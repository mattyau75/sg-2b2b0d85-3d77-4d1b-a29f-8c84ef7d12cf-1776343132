-- Add module completion flags to track sequential progress
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS m1_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS m2_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS m3_complete BOOLEAN DEFAULT FALSE;

-- Update existing games to have M1 complete if they have video and team colors
UPDATE games 
SET m1_complete = TRUE 
WHERE video_path IS NOT NULL 
AND home_team_color IS NOT NULL 
AND away_team_color IS NOT NULL;