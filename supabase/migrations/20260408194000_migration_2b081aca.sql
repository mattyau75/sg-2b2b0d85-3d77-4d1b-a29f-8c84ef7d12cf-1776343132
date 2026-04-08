-- Add video_path column to games table to store the internal Supabase Storage path
ALTER TABLE games ADD COLUMN IF NOT EXISTS video_path TEXT;