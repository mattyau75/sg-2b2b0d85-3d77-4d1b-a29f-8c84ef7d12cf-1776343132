-- Create venues table for the smart dropdown system
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add venue_id and final_score to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id),
ADD COLUMN IF NOT EXISTS home_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_score INTEGER DEFAULT 0;

-- Enable RLS for venues
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Anon insert venues" ON venues FOR INSERT WITH CHECK (true);