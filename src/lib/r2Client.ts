import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 Client (S3 Compatible)
 * Configured via environment variables in Softgen Settings.
 */
const getR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error("R2 Configuration Missing:", {
      hasAccountId: !!accountId,
      hasAccessKey: !!accessKeyId,
      hasSecretKey: !!secretAccessKey,
    });
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

export const r2Client = getR2Client();