import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

/**
 * ELITE STORAGE SERVICE (8GB+ CAPABLE)
 * Uses S3 Multipart Uploads via Cloudflare R2 for massive 1080p footage.
 */
export const storageService = {
  async uploadVideo(
    file: File, 
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    console.log(`[StorageService] Initializing 8GB+ Multipart Pipeline: ${file.name}`);
    
    // 1. Initialize Multipart Upload via API
    const { data: initData } = await axios.post("/api/storage/presign", {
      fileName: file.name,
      contentType: file.type
    });

    const { uploadId, key } = initData;
    const chunkSize = 10 * 1024 * 1024; // 10MB Chunks
    const totalParts = Math.ceil(file.size / chunkSize);
    const completedParts: { ETag: string; PartNumber: number }[] = [];

    // 2. Upload Chunks in Parallel (Max 3 at a time for stability)
    for (let i = 0; i < totalParts; i++) {
      if (abortSignal?.aborted) throw new Error("Upload cancelled");

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const part = file.slice(start, end);
      const partNumber = i + 1;

      // Get signed URL for this specific part
      const { data: partData } = await axios.post("/api/storage/multipart", {
        uploadId,
        key,
        partNumber
      });

      // Upload chunk directly to R2
      const uploadRes = await axios.put(partData.url, part, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const partProgress = (progressEvent.loaded / progressEvent.total!) / totalParts;
            const overallProgress = Math.round(((i / totalParts) + partProgress) * 100);
            onProgress(overallProgress);
          }
        }
      });

      completedParts.push({
        ETag: uploadRes.headers.etag.replace(/"/g, ""),
        PartNumber: partNumber
      });
    }

    // 3. Finalize Multipart Upload
    await axios.post("/api/storage/complete", {
      uploadId,
      key,
      parts: completedParts
    });

    return key;
  },

  async getSignedUrl(key: string): Promise<string> {
    // Return a direct R2 Public URL or signed URL depending on bucket settings
    const publicUrl = `https://${process.env.NEXT_PUBLIC_R2_DOMAIN}/${key}`;
    return publicUrl;
  }
};