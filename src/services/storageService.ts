import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

/**
 * ELITE STORAGE SERVICE: CLOUDFLARE R2 + SUPABASE HYBRID
 * Automatically routes 8GB+ files to R2 to bypass Supabase proxy limits.
 */
export const storageService = {
  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<string> {
    const isMassive = file.size > 100 * 1024 * 1024; // > 100MB
    // ONLY check for the public endpoint to trigger R2 route in browser
    const r2Ready = !!process.env.NEXT_PUBLIC_R2_ENDPOINT;

    if (r2Ready && isMassive) {
      console.log(`[StorageService] 🚀 ELITE DIRECT UPLOAD: Routing ${file.name} to Cloudflare R2.`);
      return this.uploadToR2(file, onProgress);
    }

    console.log(`[StorageService] ⚠️ Standard Lane: Routing to Supabase S3 (Only for smaller files).`);
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
      console.log(`[StorageService] Requesting signature for Part #${partNumber} of ${totalChunks}...`);
      const { data: signData } = await axios.post('/api/storage/sign-part', {
        uploadId,
        partNumber,
        key
      });

      // 3. Upload chunk directly to Cloudflare
      console.log(`[StorageService] Uploading Part #${partNumber} directly to storage...`);
      const response = await axios.put(signData.url, chunk, {
        onUploadProgress: (p) => {
          if (onProgress) {
            const currentChunkProgress = (p.loaded || 0) / (p.total || 1);
            // Increased precision to 1 decimal place for massive files
            const overallProgress = Number(((i + currentChunkProgress) / totalChunks * 100).toFixed(1));
            onProgress(Math.min(overallProgress, 99.9));
          }
        }
      });

      console.log(`[StorageService] ✅ Part #${partNumber} uploaded successfully.`);
      const etag = response.headers.etag?.replace(/"/g, '');
      uploadedParts.push({ ETag: etag, PartNumber: partNumber });
    }

    // 4. Complete the upload
    console.log(`[StorageService] 🏁 Finalizing 8GB assembly in Cloudflare...`);
    if (onProgress) onProgress(99); 

    const { data: completeData } = await axios.post('/api/storage/complete-multipart', {
      uploadId,
      key,
      parts: uploadedParts
    });

    if (onProgress) onProgress(100);
    console.log(`[StorageService] ✨ Upload Complete! File available at: ${completeData.key}`);
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
  },

  async getPresignedUrl(fileName: string): Promise<string> {
    try {
      console.log(`[StorageService] Requesting presigned URL for: ${fileName}`);
      const response = await fetch("/api/storage/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[StorageService] Presign API Error:", errorData);
        throw new Error(errorData.error || "Failed to get streaming link");
      }
    } catch (error) {
      console.error("[StorageService] Presign API Error:", error);
      throw new Error("Failed to get streaming link");
    }
  }
};