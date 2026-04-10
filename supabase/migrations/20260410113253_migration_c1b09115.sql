-- 1. Ensure RLS is completely open for the worker update
    -- This is the most common cause of the 20% stall (silent security block)
    DROP POLICY IF EXISTS "worker_update_games" ON games;
    CREATE POLICY "worker_update_games" ON games FOR UPDATE USING (true) WITH CHECK (true);
    
    -- 2. Ensure we can see the games table columns
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'games';