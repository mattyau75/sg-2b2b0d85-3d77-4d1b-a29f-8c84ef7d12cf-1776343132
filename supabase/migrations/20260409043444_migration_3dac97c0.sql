-- Add color override columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_team_color text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_team_color text;

-- Set Diamond Valley to White for the latest game
UPDATE games 
SET home_team_color = '#FFFFFF',
    away_team_color = '#008000' -- Assuming Green for Darebin Phoenix
WHERE id = '51f3bf29-26ec-4fb7-8a82-ea6e6ca3514c';