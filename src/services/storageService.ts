import axios from "axios";

/**
 * Service for handling R2 storage operations with 8GB+ Multipart Upload support.
 */
export const storageService = {
  /**
   * Uploads a video file using Multipart Upload for stability and speed.
   */
  async uploadVideo(
    file: File, 
    onProgress: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for optimal performance
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // 1. Initialize Multipart Upload
      const initResponse = await axios.post("/api/storage/multipart?action=create", {
        filename: file.name,
        contentType: file.type
      }, { signal: abortSignal });
      
      const { uploadId, key } = initResponse.data;

      const uploadedParts: { etag: string; partNumber: number }[] = [];
      let totalUploaded = 0;

      // 2. Upload parts sequentially
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // Check if aborted before starting a new part
        if (abortSignal?.aborted) throw new Error("Upload cancelled by user");

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Get signed URL for this part
        const signResponse = await axios.post("/api/storage/multipart?action=sign-part", {
          uploadId,
          key,
          partNumber
        }, { signal: abortSignal });
        
        const { url } = signResponse.data;

        // Upload the chunk
        const uploadResponse = await axios.put(url, chunk, {
          headers: { "Content-Type": file.type },
          signal: abortSignal
        });

        const etag = uploadResponse.headers.etag;
        if (!etag) throw new Error(`Failed to get ETag for part ${partNumber}`);

        uploadedParts.push({ etag, partNumber });
        
        totalUploaded += chunk.size;
        onProgress(Math.round((totalUploaded / file.size) * 100));
      }

      // 3. Complete Multipart Upload
      console.log("Upload reached 100%. Finalizing 8GB+ file reassembly...");
      const completeResponse = await axios.post("/api/storage/multipart?action=complete", {
        uploadId,
        key,
        parts: uploadedParts
      }, { signal: abortSignal });

      if (completeResponse.status !== 200) {
        throw new Error("Cloudflare R2 failed to reassemble the video parts.");
      }

      return key;
    } catch (error: any) {
      if (axios.isCancel(error) || error.name === 'CanceledError' || abortSignal?.aborted) {
        console.log("Upload aborted by user");
        throw new Error("CANCELLED");
      }
      console.error("Multipart Upload Error:", error);
      throw error;
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    const { data } = await axios.get(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    return data.url;
  }
};