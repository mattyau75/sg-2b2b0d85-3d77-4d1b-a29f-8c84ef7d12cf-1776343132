-- Add diagnostic columns to track GPU worker health and errors
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE games ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0;

-- Ensure RLS allows the API to update these new columns
DROP POLICY IF EXISTS "anon_update_games" ON games;
CREATE POLICY "anon_update_games" ON games FOR UPDATE USING (true);