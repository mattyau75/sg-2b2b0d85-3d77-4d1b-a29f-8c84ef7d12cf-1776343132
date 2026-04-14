import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { s3Client } from "@/lib/s3Client";
import { UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { uploadId, partNumber, key } = req.body;
    const client = process.env.R2_ENDPOINT ? r2Client : s3Client;
    const bucket = process.env.R2_ENDPOINT ? process.env.R2_BUCKET_NAME : "videos";

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      PartNumber: partNumber,
      UploadId: uploadId,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    return res.status(200).json({ url });
  } catch (err: any) {
    console.error("[StorageSignPart] Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}