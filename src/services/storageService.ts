import axios from "axios";

/**
 * Service for handling R2 storage operations.
 * Optimized for high-performance 8GB+ video transfers.
 */
export const storageService = {
  /**
   * Uploads a video file directly to R2 using a presigned URL.
   * Migrated to native Fetch for better stability with large binary payloads.
   */
  async uploadVideo(file: File, onProgress: (progress: number) => void): Promise<string> {
    try {
      // 1. Get signed upload URL
      const response = await axios.post("/api/storage/presign", {
        filename: file.name,
        contentType: file.type || "application/octet-stream"
      });

      const { uploadUrl, key } = response.data;

      if (!uploadUrl) {
        throw new Error("Server failed to generate an upload URL.");
      }

      // 2. Upload to R2 using native fetch (more stable for multi-GB files)
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(key);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network Error: The browser aborted the connection. Verify your R2 CORS policy."));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted by the browser."));
        });

        xhr.open("PUT", uploadUrl);
        // CRITICAL: Content-Type must match what was signed exactly
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(file);
      });
      
    } catch (error: any) {
      console.error("Storage Error:", error);
      throw error;
    }
  },

  /**
   * Generates a signed read URL for a private video file
   */
  async getSignedUrl(path: string): Promise<string> {
    const { data } = await axios.get(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    return data.url;
  }
};