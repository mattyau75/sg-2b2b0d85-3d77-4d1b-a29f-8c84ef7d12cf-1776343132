import type { NextApiRequest, NextApiResponse } from "next";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

/**
 * Generates a signed URL for direct browser-to-R2 uploads.
 * Prevents 500 errors by validating client existence and environment variables.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { filename, contentType } = req.body;

    if (!r2Client) {
      return res.status(500).json({ 
        error: "R2_CLIENT_ERROR",
        message: "R2 Client failed to initialize. Please check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in Settings > Environment." 
      });
    }

    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
    const key = `videos/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    // URL expires in 1 hour (3600 seconds)
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return res.status(200).json({ uploadUrl, key });

  } catch (error: any) {
    console.error("Presign API Error:", error);
    return res.status(500).json({ 
      error: "PRESIGN_FAILED",
      message: error.message || "Failed to generate upload URL" 
    });
  }
}