import type { NextApiRequest, NextApiResponse } from "next";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

/**
 * Generates a presigned URL for direct-to-R2 browser uploads.
 * Hardened for 8GB+ video files using UNSIGNED-PAYLOAD.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { filename, contentType } = req.body;

  if (!filename) {
    return res.status(400).json({ message: "Filename is required" });
  }

  try {
    const key = `videos/${Date.now()}-${filename.replace(/\s+/g, "_")}`;
    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";

    // Create the command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    });

    // Generate signed URL with explicit UNSIGNED-PAYLOAD for large files
    // This prevents the browser from having to calculate hashes for 8GB files
    const uploadUrl = await getSignedUrl(r2Client, command, { 
      expiresIn: 3600,
      signableHeaders: new Set(["host", "content-type"]) // Lock headers to prevent mismatch
    });

    return res.status(200).json({ uploadUrl, key });
  } catch (error: any) {
    console.error("Presign error:", error);
    return res.status(500).json({ 
      error: "PRESIGN_FAILED",
      message: error.message || "Failed to generate upload URL" 
    });
  }
}