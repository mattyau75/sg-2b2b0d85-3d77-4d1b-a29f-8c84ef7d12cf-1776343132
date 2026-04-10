-- Enable anonymous updates for the games table so the GPU worker can report progress
-- This matches the T3 (Anonymous Actions) pattern established for this table
CREATE POLICY "anon_update" ON games FOR UPDATE USING (true);

-- Ensure the progress_percentage and last_error columns are writable
-- (Already handled by the policy above)