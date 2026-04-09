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
      console.log(`[StorageService] Sending completion request for uploadId: ${uploadId}, key: ${key}`);
      console.log(`[StorageService] Completion payload:`, { uploadId, key, parts: uploadedParts.length });
      
      const completeResponse = await axios.post("/api/storage/multipart?action=complete", {
        uploadId,
        key,
        parts: uploadedParts
      }, { signal: abortSignal });

      console.log(`[StorageService] Completion response status: ${completeResponse.status}`);
      console.log(`[StorageService] Completion response data:`, completeResponse.data);

      if (completeResponse.status !== 200) {
        throw new Error("Cloudflare R2 failed to reassemble the video parts.");
      }

      if (!completeResponse.data?.success) {
        console.error("[StorageService] R2 Completion failed:", completeResponse.data);
        throw new Error(`R2 reassembly rejected: ${completeResponse.data?.message || 'Unknown error'}`);
      }

      console.log(`[StorageService] File successfully created at: ${completeResponse.data.location}`);
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
  },

  async deleteFile(path: string): Promise<void> {
    try {
      await axios.delete(`/api/storage/multipart?path=${encodeURIComponent(path)}`);
    } catch (error) {
      console.error("[StorageService] Delete File Failed:", error);
      throw error;
    }
  },

  async processGame(data: any) {
    try {
      console.log(`[StorageService] Triggering GPU analysis for Game: ${data.gameId}`);
      const response = await axios.post("/api/process-game", data);
      return response.data;
    } catch (error: any) {
      console.error("[StorageService] Process Game Failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "Failed to secure access to R2 video file.");
    }
  }
};