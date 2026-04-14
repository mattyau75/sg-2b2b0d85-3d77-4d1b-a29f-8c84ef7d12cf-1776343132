import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

/**
 * HIGH-PERFORMANCE MULTIPART STORAGE SERVICE
 * Optimized for 8GB 1080p Basketball Game Footage.
 * Uses S3 Multipart protocol to bypass infrastructure limits.
 */
export const storageService = {
  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const fileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const bucketName = 'videos';

    try {
      // 1. Initialize Multipart Upload via S3 Bridge
      console.log(`[StorageService] Starting Elite 8GB Bypass for: ${file.name}`);
      const { data: initData } = await axios.post('/api/storage/create-multipart', {
        fileName: file.name,
        contentType: file.type
      });

      const { uploadId, key } = initData;
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks for optimal balance
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadedParts = [];

      // 2. Upload Chunks in Sequence
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        // Get Presigned URL for this chunk
        const { data: signData } = await axios.post('/api/storage/sign-part', {
          uploadId,
          key,
          partNumber
        });

        // Direct Upload to S3 Gateway
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

        // Collect ETag for Final Reassembly
        const etag = (response.headers.etag || response.headers.ETag)?.replace(/"/g, '');
        if (!etag) throw new Error(`S3 Handshake Failed at Part ${partNumber}`);
        
        uploadedParts.push({ ETag: etag, PartNumber: partNumber });
      }

      // 3. Complete and Reassemble 8GB File
      await axios.post('/api/storage/complete-multipart', {
        uploadId,
        key,
        parts: uploadedParts
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