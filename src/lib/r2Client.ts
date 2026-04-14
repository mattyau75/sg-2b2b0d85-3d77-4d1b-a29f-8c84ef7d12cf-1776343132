import { S3Client } from "@aws-sdk/client-s3";

/**
 * HIGH-PERFORMANCE R2 CLIENT CONFIGURATION
 * Enforces strict S3-compatible handshake standards for Cloudflare R2.
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "", // Ensure this is the Account Endpoint: https://<id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Mandatory for R2 to correctly resolve buckets via the account endpoint
});