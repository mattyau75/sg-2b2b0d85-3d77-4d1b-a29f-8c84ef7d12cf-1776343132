import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { s3Client } from "@/lib/s3Client";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uploadId, key, parts } = req.body;
    const client = process.env.R2_ENDPOINT ? r2Client : s3Client;
    const bucket = process.env.R2_ENDPOINT ? process.env.R2_BUCKET_NAME : "videos";

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    const result = await client.send(command);
    return res.status(200).json({ location: result.Location, key: result.Key });
  } catch (err: any) {
    console.error("[StorageComplete] Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}