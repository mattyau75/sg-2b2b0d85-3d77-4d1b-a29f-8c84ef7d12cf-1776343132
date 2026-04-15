import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * DUAL-PURPOSE PRESIGN API:
 * 1. POST { fileName } -> Returns GET presigned URL for secure streaming (3600s)
 * 2. POST { fileName, contentType, isUpload: true } -> Returns Multipart Upload ID
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType, isUpload } = req.body;
    const bucket = process.env.R2_BUCKET_NAME || 'videos';
    
    // Ensure we have a clean key (no bucket prefix)
    const key = fileName.startsWith(`${bucket}/`) 
      ? fileName.replace(`${bucket}/`, '') 
      : fileName;

    // FLOW A: Secure Streaming (GET)
    if (!isUpload) {
      console.log(`[StoragePresign] Generating GET signature for: ${key}`);
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      // Valid for 1 hour (3600 seconds)
      const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      return res.status(200).json({ url });
    }

    // FLOW B: Multipart Upload (Existing logic)
    console.log(`[StoragePresign] Initializing Multipart Upload for: ${key}`);
    const uploadKey = `videos/${Date.now()}-${key}`;
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: uploadKey,
      ContentType: contentType,
    });

    const { UploadId, Key } = await r2Client.send(command);
    return res.status(200).json({ uploadId: UploadId, key: Key });

  } catch (err: any) {
    console.error("[StoragePresign] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}