import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID || "a7732b05eed44346d0b8d0e6edd40ad3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "8555a552d03c38611e0f32907e47f517",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "8763de0bf9f71066128de8c35740dce437ab7944ee3b6c94c9d4b521832ba4e1",
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "courtvision-videos";