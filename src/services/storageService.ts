import { supabase } from "@/integrations/supabase/client";

export const storageService = {
  async uploadVideo(file: File, gameId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${gameId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `game-videos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('game-videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
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