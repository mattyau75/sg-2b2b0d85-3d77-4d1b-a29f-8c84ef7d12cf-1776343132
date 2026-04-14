import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";

/**
 * HIGH-PERFORMANCE SUPABASE STORAGE SERVICE
 * Optimized for large basketball game footage (up to 8GB) using TUS resumable protocol.
 */
export const storageService = {
  async uploadVideo(
    file: File, 
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    console.log(`[StorageService] Initializing Resumable TUS Upload for 8GB capacity: ${filePath}`);

    // Get the session to authorize the TUS upload
    const { data: { session } } = await supabase.auth.getSession();
    const bearerToken = session?.access_token;
    
    // Construct the TUS endpoint for Supabase
    // Format: https://[PROJECT_REF].supabase.co/storage/v1/upload/resumable
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const uploadUrl = `${supabaseUrl}/storage/v1/upload/resumable`;

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
          size: file.size.toString(), // CRITICAL: Explicit size handshake
        },
        chunkSize: 5 * 1024 * 1024, // Reduced to 5MB to bypass potential proxy payload limits
        onError: (error) => {
          console.error("[StorageService] TUS Upload failed:", error);
          
          // Better error reporting for 413
          if (error.message.includes("413")) {
            reject(new Error("Supabase Storage Proxy Limit Reached (413). Please increase the limit in Supabase Dashboard -> Storage -> Settings to 10GB."));
          } else {
            reject(error);
          }
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

      // Check if there's a previous upload to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  },

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from("videos")
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error("[SupabaseStorage] Signed URL error:", error);
      throw error;
    }

    return data.signedUrl;
  }
};