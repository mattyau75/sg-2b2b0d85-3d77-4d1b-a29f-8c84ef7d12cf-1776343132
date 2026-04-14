import { S3Client } from "@aws-sdk/client-s3";

/**
 * ELITE SUPABASE S3 DIRECT CLIENT
 * Bypasses the API Gateway (supabase.co) to avoid 413/500 Proxy limits.
 */
const PROJECT_REF = "hoqnqzghpkppewhhxrfv";
const REGION = "us-east-1"; 

export const s3Client = new S3Client({
  region: REGION,
  endpoint: `https://${PROJECT_REF}.supabase.co/storage/v1/s3`,
  credentials: {
    accessKeyId: PROJECT_REF,
    secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "", 
  },
  forcePathStyle: true,
});