import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE CLOUDFLARE R2 CLIENT (SERVER-SIDE)
 */
const endpoint = process.env.R2_ENDPOINT || process.env.NEXT_PUBLIC_R2_ENDPOINT || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: endpoint,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});