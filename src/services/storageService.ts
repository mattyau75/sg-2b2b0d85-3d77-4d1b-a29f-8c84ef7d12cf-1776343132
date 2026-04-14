import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

/**
 * ELITE STORAGE SERVICE - S3 MULTIPART EDITION
 * Optimized for 8GB 1080p 60-minute video streams.
 * Bypasses Supabase Proxy limits by using chunked S3 uploads.
 */
export const storageService = {
  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const fileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const bucketName = 'videos';

    try {
      // 1. Initialize Multipart Upload
      const { data: initData } = await axios.post('/api/storage/create-multipart', {
        fileName,
        contentType: file.type,
        bucketName
      });

      const { uploadId, key } = initData;
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks to stay under proxy limits
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadedParts = [];

      // 2. Upload Chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        // Get Presigned URL for this specific chunk
        const { data: signData } = await axios.post('/api/storage/sign-part', {
          uploadId,
          key,
          partNumber,
          bucketName
        });

        // Upload part directly to S3 endpoint
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

        // Collect ETag for completion (headers are case-insensitive in axios)
        // We trim quotes because S3 ETags are often wrapped in them
        const etag = (response.headers.etag || response.headers.ETag)?.replace(/"/g, '');
        if (!etag) throw new Error(`Failed to get ETag for part ${partNumber}`);
        
        uploadedParts.push({ ETag: etag, PartNumber: partNumber });
      }

      // 3. Complete Multipart Upload
      await axios.post('/api/storage/complete-multipart', {
        uploadId,
        key,
        parts: uploadedParts,
        bucketName
      });

      return key;
    } catch (error: any) {
      console.error("[StorageService] Massive Upload Failed:", error);
      throw error;
    }
  },

  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }
};