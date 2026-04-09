-- Add jersey_number column to play_by_play if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='play_by_play' AND column_name='jersey_number') THEN
    ALTER TABLE play_by_play ADD COLUMN jersey_number INTEGER;
  END IF;
END $$;