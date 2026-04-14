import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";

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
    abortSignal?: AbortSignal
  ): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log(`[StorageService] Initializing Resumable TUS Upload: ${filePath}`);

    // Get the session to authorize the TUS upload
    const { data: { session } } = await supabase.auth.getSession();
    const bearerToken = session?.access_token;
    
    // Construct the TUS endpoint for Supabase
    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0];
    const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: uploadUrl,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${bearerToken || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: 'videos',
          objectName: filePath,
          contentType: file.type,
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks for balanced performance
        onError: (error) => {
          console.error("[StorageService] TUS Upload failed:", error);
          reject(error);
        },
        onProgress: (bytesSent, bytesTotal) => {
          const percentage = Math.round((bytesSent / bytesTotal) * 100);
          if (onProgress) onProgress(percentage);
        },
        onSuccess: () => {
          console.log(`[StorageService] TUS Upload completed: ${filePath}`);
          resolve(filePath);
        },
      });

      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          upload.abort();
          reject(new Error("Upload aborted by user"));
        });
      }

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
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