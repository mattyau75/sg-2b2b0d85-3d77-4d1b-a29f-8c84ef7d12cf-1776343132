-- 1. Ensure the 'videos' bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies on the objects table for this bucket to avoid conflicts
-- Supabase stores policies in pg_catalog.pg_policy, but it's safer to use DROP POLICY IF EXISTS
DROP POLICY IF EXISTS "Allow public upload to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from videos" ON storage.objects;

-- 3. Create the broad access policies correctly
CREATE POLICY "Allow public upload to videos" 
ON storage.objects FOR INSERT 
TO public
WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow public select from videos" 
ON storage.objects FOR SELECT 
TO public
USING (bucket_id = 'videos');

CREATE POLICY "Allow public update to videos" 
ON storage.objects FOR UPDATE 
TO public
USING (bucket_id = 'videos');

CREATE POLICY "Allow public delete from videos" 
ON storage.objects FOR DELETE 
TO public
USING (bucket_id = 'videos');