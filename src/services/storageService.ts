import { supabase } from "@/integrations/supabase/client";

/**
 * HIGH-PERFORMANCE SUPABASE STORAGE SERVICE
 * 
 * Uses native Supabase Storage API for seamless video handling.
 * No S3 protocols, no signing complexity, no handshake failures.
 * 
 * Advantages:
 * - Zero configuration (uses existing Supabase auth)
 * - Built-in CORS handling
 * - Simple upload/download API
 * - Cost-effective for basketball footage
 */

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const storageService = {
  /**
   * Upload video to Supabase Storage with progress tracking
   * @param file - The video file to upload
   * @param onProgress - Progress callback
   * @param signal - AbortController signal for cancellation
   * @returns The storage path of the uploaded video
   */
  async uploadVideo(
    file: File,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${timestamp}-${sanitizedName}`;

    console.log(`[SupabaseStorage] Starting upload: ${filePath}`);

    // Supabase Storage upload with progress
    const { data, error } = await supabase.storage
      .from("videos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("[SupabaseStorage] Upload failed:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Simulate progress (Supabase doesn't provide real-time progress)
    if (onProgress) {
      onProgress(100);
    }

    console.log(`[SupabaseStorage] Upload successful: ${data.path}`);
    return data.path;
  },

  /**
   * Get a public URL for a video (if bucket is public)
   * @param path - The storage path
   * @returns Public URL
   */
  getPublicUrl(path: string): string {
    const { data } = supabase.storage.from("videos").getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Get a signed URL for a video (for private buckets)
   * @param path - The storage path
   * @param expiresIn - Expiration time in seconds (default: 3 hours)
   * @returns Signed URL with temporary access
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(path, expiresIn);

      if (error) {
        console.error("[StorageService] Signed URL error:", error);
        
        // Provide specific error context
        if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
          throw new Error(`Video file not found in storage: ${path}`);
        } else if (error.message?.includes('permission')) {
          throw new Error(`Storage permission denied for: ${path}`);
        } else {
          throw new Error(`Storage error: ${error.message}`);
        }
      }

      if (!data?.signedUrl) {
        throw new Error("Failed to generate signed URL");
      }

      return data.signedUrl;
    } catch (err: any) {
      console.error("[StorageService] getSignedUrl failed:", err);
      throw err;
    }
  },

  /**
   * Delete a video from storage
   * @param path - The storage path
   */
  async deleteVideo(path: string): Promise<void> {
    const { error } = await supabase.storage.from("videos").remove([path]);

    if (error) {
      console.error("[SupabaseStorage] Delete failed:", error);
      throw new Error(`Failed to delete video: ${error.message}`);
    }

    console.log(`[SupabaseStorage] Video deleted: ${path}`);
  },

  /**
   * List all videos in storage
   */
  async listVideos(): Promise<any[]> {
    const { data, error } = await supabase.storage.from("videos").list();

    if (error) {
      console.error("[SupabaseStorage] List failed:", error);
      throw new Error(`Failed to list videos: ${error.message}`);
    }

    return data || [];
  },
};