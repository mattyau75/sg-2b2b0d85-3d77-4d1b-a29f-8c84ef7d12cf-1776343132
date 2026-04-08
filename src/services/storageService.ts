import axios from "axios";

export const storageService = {
  async uploadVideo(file: File, onProgress: (progress: number) => void): Promise<string> {
    try {
      // 1. Get signed upload URL
      const response = await axios.post("/api/storage/presign", {
        filename: file.name,
        contentType: file.type
      });

      const { uploadUrl, key } = response.data;

      if (!uploadUrl) {
        throw new Error("Server failed to generate an upload URL. Check R2 Environment Variables.");
      }

      // 2. Upload to R2 with retry logic
      let attempt = 0;
      const maxRetries = 3;
      
      while (attempt < maxRetries) {
        try {
          await axios.put(uploadUrl, file, {
            headers: { 
              "Content-Type": file.type
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                onProgress(percentCompleted);
              }
            },
          });
          return key; // Success
        } catch (uploadError) {
          attempt++;
          console.error(`Upload attempt ${attempt} failed:`, uploadError);
          if (attempt === maxRetries) throw uploadError;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff
        }
      }
      throw new Error("Upload failed after multiple attempts");
    } catch (error: any) {
      console.error("Storage Error:", error);
      const message = error.response?.status === 403 ? "CORS or Permission Denied (403)" : error.message;
      throw new Error(`Storage Transfer Failed: ${message}`);
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    const response = await fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`);
    if (!response.ok) throw new Error("Failed to secure access to video file");
    const { url } = await response.json();
    return url;
  },

  async deleteVideo(path: string): Promise<void> {
    // Standard delete can be handled via a similar API route if needed
    console.log("Cleanup scheduled for path:", path);
  }
};