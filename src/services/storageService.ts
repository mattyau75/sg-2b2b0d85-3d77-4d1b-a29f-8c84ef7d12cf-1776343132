import { supabase } from "@/integrations/supabase/client";

export const storageService = {
  async uploadVideoResumable(
    file: File, 
    gameId: string, 
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${gameId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = fileName;

    // Use standard upload which is more reliable across all Supabase versions
    // Note: Standard uploads are typically limited to 5GB. 
    // For 8GB+, the Tus endpoint must be enabled in Supabase Dashboard.
    const { data, error } = await supabase.storage
      .from('game-videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Upload failed:", error);
      throw error;
    }

    return data.path;
  },

  async getSignedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('game-videos')
      .createSignedUrl(path, 3600); // 1 hour access

    if (error) throw error;
    return data.signedUrl;
  },

  async deleteVideo(path: string) {
    const { error } = await supabase.storage
      .from('game-videos')
      .remove([path]);

    if (error) throw error;
  }
};