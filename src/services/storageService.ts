import axios from "axios";

/**
 * Service for handling R2 storage operations with 8GB+ Multipart Upload support.
 */
export const storageService = {
  /**
   * Uploads a video file using Multipart Upload for stability and speed.
   */
  async uploadVideo(file: File, onProgress: (progress: number) => void): Promise<string> {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for optimal performance
    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // 1. Initialize Multipart Upload
      const initResponse = await axios.post("/api/storage/multipart?action=create", {
        filename: file.name,
        contentType: file.type
      });
      const { uploadId, key } = initResponse.data;

      const uploadedParts: { etag: string; partNumber: number }[] = [];
      let totalUploaded = 0;

      // 2. Upload parts sequentially (can be parallelized later)
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Get signed URL for this part
        const signResponse = await axios.post("/api/storage/multipart?action=sign-part", {
          uploadId,
          key,
          partNumber
        });
        const { url } = signResponse.data;

        // Upload the chunk
        const uploadResponse = await axios.put(url, chunk, {
          headers: { "Content-Type": file.type }
        });

        const etag = uploadResponse.headers.etag;
        if (!etag) throw new Error(`Failed to get ETag for part ${partNumber}`);

        uploadedParts.push({ etag, partNumber });
        
        totalUploaded += chunk.size;
        onProgress(Math.round((totalUploaded / file.size) * 100));
      }

      // 3. Complete Multipart Upload
      await axios.post("/api/storage/multipart?action=complete", {
        uploadId,
        key,
        parts: uploadedParts
      });

      return key;
    } catch (error: any) {
      console.error("Multipart Upload Error:", error);
      throw error;
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    const { data } = await axios.get(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    return data.url;
  }
};