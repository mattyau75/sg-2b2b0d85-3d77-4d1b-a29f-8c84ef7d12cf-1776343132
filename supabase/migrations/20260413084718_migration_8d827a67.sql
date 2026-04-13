-- 🛡️ FINAL DATABASE HARDENING: Ensure 100% Handshake Reliability
-- This ensures the UNIQUE constraint exists and columns are ready for high-speed batch pulses
DO $$ 
BEGIN
  -- 1. Ensure game_analysis table has the correct unique constraint
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_analysis_game_id_key') THEN
    ALTER TABLE public.game_analysis ADD CONSTRAINT game_analysis_game_id_key UNIQUE (game_id);
  END IF;

  -- 2. Add high-density tracking columns to games if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='progress_percentage') THEN
    ALTER TABLE public.games ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='status_message') THEN
    ALTER TABLE public.games ADD COLUMN status_message TEXT;
  END IF;
END $$;