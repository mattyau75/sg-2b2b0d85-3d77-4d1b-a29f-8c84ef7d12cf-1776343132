import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

/**
 * ELITE STORAGE SERVICE: CLOUDFLARE R2 + SUPABASE HYBRID
 * Automatically routes 8GB+ files to R2 to bypass Supabase proxy limits.
 */
export const storageService = {
  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const isMassive = file.size > 500 * 1024 * 1024; // > 500MB
    const hasR2 = !!process.env.R2_ENDPOINT && !!process.env.R2_ACCESS_KEY_ID;
    const useR2 = hasR2 && isMassive;

    if (useR2) {
      console.log(`[StorageService] Elite Lane: Routing 8GB+ file to Cloudflare R2: ${file.name}`);
      return this.uploadToR2(file, onProgress);
    }

    console.log(`[StorageService] Standard Lane: Routing to Supabase S3: ${file.name}`);
    return this.uploadToSupabase(file, onProgress);
  },

  async uploadToR2(file: File, onProgress?: (progress: number) => void): Promise<string> {
    // 1. Initialize Multipart Upload via R2 API bridge
    const { data: initData } = await axios.post('/api/storage/presign', {
      fileName: file.name,
      contentType: file.type
    });

    const { uploadId, key } = initData;
    const chunkSize = 10 * 1024 * 1024; // 10MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadedParts = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const partNumber = i + 1;

      // 2. Sign the part for direct R2 upload
      const { data: signData } = await axios.post('/api/storage/sign-part', {
        uploadId,
        partNumber,
        key
      });

      // 3. Upload chunk directly to Cloudflare
      const response = await axios.put(signData.url, chunk, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (p) => {
          if (onProgress) {
            const currentChunkProgress = (p.loaded || 0) / (p.total || 1);
            const overallProgress = Math.round(((i + currentChunkProgress) / totalChunks) * 100);
            onProgress(Math.min(overallProgress, 99));
          }
        }
      });

      const etag = response.headers.etag?.replace(/"/g, '');
      uploadedParts.push({ ETag: etag, PartNumber: partNumber });
    }

    // 4. Complete the upload
    const { data: completeData } = await axios.post('/api/storage/complete-multipart', {
      uploadId,
      key,
      parts: uploadedParts
    });

    return completeData.key;
  },

  async uploadToSupabase(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const filePath = `${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("videos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;
    return data.path;
  },

  async getUrl(filePath: string): Promise<string> {
    // Logic to resolve either R2 or Supabase URLs
    if (filePath.startsWith('videos/')) {
      // Logic for R2 signed URL would go here
      return `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ENDPOINT}/${filePath}`;
    }
    const { data } = supabase.storage.from("videos").getPublicUrl(filePath);
    return data.publicUrl;
  }
};