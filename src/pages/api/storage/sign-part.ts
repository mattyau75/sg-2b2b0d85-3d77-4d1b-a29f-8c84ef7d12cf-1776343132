import { NextApiRequest, NextApiResponse } from "next";
import { s3Client } from "@/lib/s3Client";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uploadId, key, partNumber, bucketName = "videos" } = req.body;

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return res.status(200).json({ url });
  } catch (err: any) {
    console.error("[StorageSignPart] Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}