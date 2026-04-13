import axios from "axios";

/**
 * Service for handling R2 storage operations with Parallel Multipart Upload support.
 */
export const storageService = {
  /**
   * Uploads a video file using Parallel Multipart Upload for maximum speed.
   */
  async uploadVideo(
    file: File, 
    onProgress: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `videos/${timestamp}-${sanitizedName}`;
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const CONCURRENCY_LIMIT = 5; // Upload 5 parts simultaneously

    try {
      // 1. Initialize Multipart Upload
      const initResponse = await axios.post("/api/storage/multipart?action=create", {
        filename: file.name,
        contentType: file.type
      }, { signal: abortSignal });
      
      const { uploadId } = initResponse.data;

      const uploadedParts: { etag: string; partNumber: number }[] = [];
      const totalUploaded = 0;
      const activeUploads = 0;
      let nextPartToUpload = 1;
      let hasError = false;
      let lastErrorMessage = "";

      // Progress tracker for all parts
      const partsProgress: Record<number, number> = {};

      const uploadPart = async (partNumber: number): Promise<void> => {
        if (hasError || abortSignal?.aborted) return;

        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        try {
          // Get signed URL
          const signResponse = await axios.post("/api/storage/multipart?action=sign-part", {
            uploadId,
            key,
            partNumber
          }, { signal: abortSignal });
          
          const { url } = signResponse.data;

          // Upload chunk with progress tracking for this specific part
          const uploadResponse = await axios.put(url, chunk, {
            headers: { "Content-Type": file.type },
            signal: abortSignal,
            onUploadProgress: (progressEvent) => {
              if (progressEvent.loaded) {
                partsProgress[partNumber] = progressEvent.loaded;
                const totalLoaded = Object.values(partsProgress).reduce((a, b) => a + b, 0);
                onProgress(Math.round((totalLoaded / file.size) * 100));
              }
            }
          });

          const etag = uploadResponse.headers.etag;
          if (!etag) throw new Error(`Failed to get ETag for part ${partNumber}`);

          uploadedParts.push({ etag, partNumber });
        } catch (error: any) {
          if (!axios.isCancel(error)) {
            hasError = true;
            lastErrorMessage = error.message;
          }
          throw error;
        }
      };

      // Worker pool logic
      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, totalParts) }).map(async () => {
        while (nextPartToUpload <= totalParts && !hasError && !abortSignal?.aborted) {
          const partNumber = nextPartToUpload++;
          await uploadPart(partNumber);
        }
      });

      await Promise.all(workers);

      if (hasError) throw new Error(lastErrorMessage || "Parallel upload failed");
      if (abortSignal?.aborted) throw new Error("CANCELLED");

      // 3. Complete Multipart Upload
      console.log("Parallel upload complete. Finalizing reassembly...");
      
      const completeResponse = await axios.post("/api/storage/multipart?action=complete", {
        uploadId,
        key,
        parts: uploadedParts.sort((a, b) => a.partNumber - b.partNumber)
      }, { signal: abortSignal });

      if (!completeResponse.data?.success) {
        throw new Error(completeResponse.data?.message || "R2 reassembly rejected.");
      }

      // Ensure key is returned without leading slashes for database consistency
      const finalKey = key.startsWith('/') ? key.slice(1) : key;
      return finalKey;
    } catch (error: any) {
      if (axios.isCancel(error) || abortSignal?.aborted) {
        throw new Error("CANCELLED");
      }
      throw error;
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    // Generate a 3-hour expiry URL for heavy-payload GPU processing
    const { data } = await axios.get(`/api/storage/signed-url?path=${encodeURIComponent(path)}&expiry=10800`);
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
      const response = await axios.post("/api/process-game", data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to secure access to R2 video file.");
    }
  }
};