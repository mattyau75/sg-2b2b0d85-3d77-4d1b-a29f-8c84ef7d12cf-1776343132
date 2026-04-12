-- CREATE THE LIVE TRACE TABLE FOR GPU LOGGING
CREATE TABLE IF NOT EXISTS game_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'initializing',
    status_message TEXT,
    progress_percentage INTEGER DEFAULT 0,
    worker_logs JSONB DEFAULT '[]'::jsonb,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE PUBLIC ACCESS FOR THE GPU WORKER (T3 Policy)
ALTER TABLE game_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_analysis" ON game_analysis FOR SELECT USING (true);
CREATE POLICY "anon_insert_analysis" ON game_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_analysis" ON game_analysis FOR UPDATE USING (true);

-- ADD MISSING STATUS FIELD TO GAMES FOR REDUNDANCY
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='ignition_status') THEN
        ALTER TABLE games ADD COLUMN ignition_status TEXT DEFAULT 'pending';
    END IF;
END $$;