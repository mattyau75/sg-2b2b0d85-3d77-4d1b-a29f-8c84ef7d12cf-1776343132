import { NextApiRequest, NextApiResponse } from "next";
import { s3Client } from "@/lib/s3Client";
import { CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uploadId, key, parts, bucketName = "videos" } = req.body;

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    await s3Client.send(command);
    return res.status(200).json({ success: true, key });
  } catch (err: any) {
    console.error("[StorageComplete] Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}