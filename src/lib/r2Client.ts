import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE CLOUDFLARE R2 CLIENT
 * This is the definitive solution for 8GB+ video files.
 */
const endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.R2_ENDPOINT || "";
const accessKeyId = process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: endpoint,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});