-- 🛡️ ENHANCING GAME_EVENTS FOR HIGH-FIDELITY TRACING
-- Adding severity and module_id if they don't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_events' AND column_name = 'severity') THEN
    ALTER TABLE public.game_events ADD COLUMN severity TEXT DEFAULT 'info';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_events' AND column_name = 'module_id') THEN
    ALTER TABLE public.game_events ADD COLUMN module_id TEXT;
  END IF;
END $$;

-- 🛡️ Ensure RLS for GPU/App tracing
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON public.game_events FOR SELECT USING (true);
CREATE POLICY "System insert events" ON public.game_events FOR INSERT WITH CHECK (true);