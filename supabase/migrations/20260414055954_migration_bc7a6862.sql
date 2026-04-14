-- 1. Create the 'videos' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read videos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'videos' );

-- 3. Allow authenticated users to upload videos
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'videos' );

-- 4. Allow authenticated users to update/delete their own videos
CREATE POLICY "Authenticated Manage"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'videos' );

CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'videos' );