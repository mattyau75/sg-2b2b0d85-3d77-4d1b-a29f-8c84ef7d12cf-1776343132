import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType } = req.body;
    const key = `videos/${Date.now()}-${fileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const { UploadId, Key } = await r2Client.send(command);

    return res.status(200).json({ uploadId: UploadId, key: Key });
  } catch (err: any) {
    console.error("[StoragePresign] Failed to create multipart upload:", err);
    return res.status(500).json({ error: err.message });
  }
}