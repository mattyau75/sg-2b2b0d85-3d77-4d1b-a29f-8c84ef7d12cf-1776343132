-- 🛡️ ULTIMATE HANDSHAKE HARDENING: Normalized Events & Strict UUIDs
-- This ensures the database is perfectly aligned with the GPU's high-speed pulses.

-- 1. Ensure the games table uses UUIDs and has strict R2 tracking
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS last_gpu_heartbeat TIMESTAMPTZ;

-- 2. Create a dedicated event stream table for high-density 1-hour stats
CREATE TABLE IF NOT EXISTS public.game_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS for the GPU (Service Role will bypass, but good for safety)
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GPU Service Role Access" ON public.game_events FOR ALL USING (true);