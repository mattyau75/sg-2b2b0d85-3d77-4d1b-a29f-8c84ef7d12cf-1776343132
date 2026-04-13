-- 🛡️ FORENSIC DIAGNOSTIC TABLE: A "Clean Room" for Handshake Testing
CREATE TABLE IF NOT EXISTS public.handshake_debug (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'idle',
    message TEXT,
    gpu_heartbeat TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure public access for the test page
ALTER TABLE public.handshake_debug ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read" ON public.handshake_debug;
CREATE POLICY "Public Read" ON public.handshake_debug FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Update" ON public.handshake_debug;
CREATE POLICY "Public Update" ON public.handshake_debug FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public Insert" ON public.handshake_debug;
CREATE POLICY "Public Insert" ON public.handshake_debug FOR INSERT WITH CHECK (true);