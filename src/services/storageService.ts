import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";

export const storageService = {
  async uploadVideoResumable(
    file: File, 
    gameId: string, 
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${gameId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = fileName;

    const { data: { session } } = await supabase.auth.getSession();
    
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session?.access_token || ''}`,
          'x-upsert': 'true',
        },
        metadata: {
          bucketName: 'game-videos',
          objectName: filePath,
          contentType: file.type,
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks for reliability
        onError: (error) => {
          console.error("Tus upload failed:", error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          if (onProgress) onProgress(bytesUploaded, bytesTotal);
        },
        onSuccess: () => {
          console.log("Tus upload successful:", filePath);
          resolve(filePath);
        },
      });

      upload.start();
    });
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