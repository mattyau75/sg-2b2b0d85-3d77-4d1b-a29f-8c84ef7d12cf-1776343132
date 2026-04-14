import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE CLOUDFLARE R2 CLIENT
 * This is the definitive solution for 8GB+ video files.
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "", 
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});