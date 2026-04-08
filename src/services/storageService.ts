export const storageService = {
  async uploadVideo(
    file: File, 
    gameId: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${gameId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    // 1. Get presigned URL from our API (secure handover)
    const response = await fetch("/api/storage/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, contentType: file.type }),
    });
    
    if (!response.ok) throw new Error("Failed to get secure upload gateway");
    const { uploadUrl } = await response.json();

    // 2. Upload directly to R2 using XHR for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      
      xhr.onload = () => {
        if (xhr.status === 200) resolve(fileName);
        else reject(new Error(`Storage error: ${xhr.statusText}`));
      };
      
      xhr.onerror = () => reject(new Error("Network error during storage transfer"));
      xhr.send(file);
    });
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