-- 🛡️ DATABASE HARDENING: Ensure the Handshake Bridge is UPSERT-ready
-- This prevents the 42501/42P10 errors that cause the 12% stall.
ALTER TABLE public.game_analysis DROP CONSTRAINT IF EXISTS game_analysis_game_id_key;
ALTER TABLE public.game_analysis ADD CONSTRAINT game_analysis_game_id_key UNIQUE (game_id);

-- Ensure the 'games' table is ready for the high-density sync
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'status_message') THEN
    ALTER TABLE public.games ADD COLUMN status_message TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'progress_percentage') THEN
    ALTER TABLE public.games ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
END $$;