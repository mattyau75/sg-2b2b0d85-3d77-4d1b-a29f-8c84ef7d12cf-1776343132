-- Ensure Service Role has absolute power over the games tracking columns
-- This bypasses any RLS issues for the worker
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'games' AND policyname = 'service_role_worker_sync'
    ) THEN
        CREATE POLICY "service_role_worker_sync" ON games 
        FOR UPDATE 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;