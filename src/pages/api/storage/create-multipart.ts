import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { s3Client } from "@/lib/s3Client";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType } = req.body;
    const key = `videos/${Date.now()}-${fileName}`;
    
    // Auto-detect R2 or fallback to Supabase S3
    const client = process.env.R2_ENDPOINT ? r2Client : s3Client;
    const bucket = process.env.R2_ENDPOINT ? process.env.R2_BUCKET_NAME : "videos";

    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const { UploadId, Key } = await client.send(command);

    return res.status(200).json({ uploadId: UploadId, key: Key });
  } catch (err: any) {
    console.error("[StorageCreateMultipart] Failed:", err);
    return res.status(500).json({ 
      error: "Infrastructure Handshake Failed", 
      message: err.message,
      target: process.env.R2_ENDPOINT ? "Cloudflare R2" : "Supabase S3"
    });
  }
}