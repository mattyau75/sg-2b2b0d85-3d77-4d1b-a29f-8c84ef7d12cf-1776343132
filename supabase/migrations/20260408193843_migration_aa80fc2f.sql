-- Create a bucket for game videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('game-videos', 'game-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS for the game-videos bucket
CREATE POLICY "Authenticated users can upload videos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'game-videos');

CREATE POLICY "Authenticated users can view their own videos" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'game-videos');

CREATE POLICY "Authenticated users can delete their own videos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'game-videos');