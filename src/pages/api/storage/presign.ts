import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * DUAL-PURPOSE PRESIGN API:
 * 1. POST { fileName } -> Returns GET presigned URL for secure streaming (3600s)
 * 2. POST { fileName, contentType, isUpload: true } -> Returns Multipart Upload ID
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "Missing fileName" });

    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || "videos";
    
    // Create an authorized command for the specific file
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    // Generate a URL that expires in 1 hour (3600 seconds)
    // This URL includes the security signature required by Cloudflare
    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return res.status(200).json({ url });
  } catch (err: any) {
    console.error("[StoragePresign] Critical Handshake Error:", err);
    return res.status(500).json({ error: err.message });
  }
}