-- 🛡️ ATOMIC CLEANUP & HARDENING (UUID TYPE COMPATIBLE)

-- 1. Remove duplicate entries, keeping only the most recent row per game
DELETE FROM public.game_analysis a
USING public.game_analysis b
WHERE a.id < b.id 
  AND a.game_id = b.game_id;

-- 2. Apply the UNIQUE constraint on the UUID column
-- This enables the GPU's ON CONFLICT (game_id) DO UPDATE logic
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'game_analysis_game_id_unique') THEN
    ALTER TABLE public.game_analysis 
    ADD CONSTRAINT game_analysis_game_id_unique UNIQUE (game_id);
  END IF;
END $$;

-- 3. Ensure master tracking columns exist on the games table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='progress_percentage') THEN
    ALTER TABLE public.games ADD COLUMN progress_percentage INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='status_message') THEN
    ALTER TABLE public.games ADD COLUMN status_message TEXT;
  END IF;
END $$;