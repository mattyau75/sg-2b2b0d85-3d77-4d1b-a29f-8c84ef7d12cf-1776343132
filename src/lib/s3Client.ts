import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE SUPABASE S3 CLIENT
 * Uses the stable S3-Compatible API bridge for 8GB+ video files.
 */
const projectRef = typeof window === 'undefined' 
  ? process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0]
  : ""; // Client-side project ref extraction not needed for server-side S3 client

export const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
  credentials: {
    accessKeyId: projectRef || "",
    secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", 
  },
  forcePathStyle: true,
});