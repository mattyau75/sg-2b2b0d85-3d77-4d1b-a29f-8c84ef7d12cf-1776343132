-- Add video_url column to play_by_play to support highlights and clip tracking
ALTER TABLE play_by_play ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Update RLS if necessary (it already has public read/update, but just to be sure)
-- Policies for play_by_play are already 'true' for anon, so it should be fine.