-- Add stage verification columns to the games table
    ALTER TABLE games 
    ADD COLUMN IF NOT EXISTS setup_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS analysis_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mapping_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS finalize_verified BOOLEAN DEFAULT FALSE;

    -- Update RLS for these new columns (assuming T2 style: public read, auth write)
    CREATE POLICY "auth_update_verification" ON games 
    FOR UPDATE USING (auth.uid() IS NOT NULL);