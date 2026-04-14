import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE SUPABASE S3 CLIENT
 * Bypasses standard proxy limits for 8GB+ video files.
 */
export const s3Client = new S3Client({
  region: "us-east-1", // Supabase S3 default region
  endpoint: `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split(".")[0]}.supabase.co/storage/v1/s3`,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", // Using anon key for S3 auth
    secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", 
  },
  forcePathStyle: true,
});