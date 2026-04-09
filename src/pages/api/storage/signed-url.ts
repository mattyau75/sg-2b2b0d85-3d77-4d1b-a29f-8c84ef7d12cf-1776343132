import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

export const r2Client = new S3Client({
  region: "us-east-1", // Using us-east-1 as a static fallback for R2 compatibility
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ message: "Path is required" });
  }

  try {
    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: path as string,
    });

    // Increase expiry to 24 hours to ensure long analysis jobs don't time out on the URL
    const url = await getSignedUrl(r2Client, command, { expiresIn: 86400 });

    return res.status(200).json({ url });
  } catch (error: any) {
    console.error("[SignedUrl] Error generating URL:", error);
    return res.status(500).json({ message: error.message });
  }
}