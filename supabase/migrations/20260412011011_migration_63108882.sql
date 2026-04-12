-- Ensure service_role and public can always update game progress
DROP POLICY IF EXISTS "service_role_worker_sync" ON games;
CREATE POLICY "service_role_worker_sync" ON games
FOR UPDATE 
TO public
USING (true)
WITH CHECK (true);

-- Ensure the worker can update its logs
DROP POLICY IF EXISTS "ai_worker_update_progress" ON games;
CREATE POLICY "ai_worker_update_progress" ON games
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);