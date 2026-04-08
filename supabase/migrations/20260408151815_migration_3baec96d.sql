-- Add camera configuration tracking to the games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS camera_type TEXT DEFAULT 'panning';