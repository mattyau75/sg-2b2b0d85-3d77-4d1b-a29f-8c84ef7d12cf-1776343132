-- Step 1: Add missing status and tracking columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS ignition_status text DEFAULT 'pending';
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_heartbeat timestamp with time zone;
ALTER TABLE games ADD COLUMN IF NOT EXISTS video_path text;

-- Step 2: Ensure RLS allows the worker to update these columns
-- We drop existing restrictive policies and add a broad 'worker' update policy
DROP POLICY IF EXISTS "allow_worker_updates" ON games;
DROP POLICY IF EXISTS "worker_update_games" ON games;

CREATE POLICY "ai_worker_update_progress" ON games 
FOR UPDATE TO public
USING (true)
WITH CHECK (true);

-- Step 3: Ensure snapshots bucket exists for discovery images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('snapshots', 'snapshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Snapshots" ON storage.objects FOR SELECT USING (bucket_id = 'snapshots');
CREATE POLICY "Worker Upload Snapshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'snapshots');