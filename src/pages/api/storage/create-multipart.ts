import { NextApiRequest, NextApiResponse } from "next";
import { s3Client } from "@/lib/s3Client";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType } = req.body;
    const key = `videos/${Date.now()}-${fileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: "videos",
      Key: key,
      ContentType: contentType,
    });

    const { UploadId, Key } = await s3Client.send(command);

    return res.status(200).json({ uploadId: UploadId, key: Key });
  } catch (err: any) {
    console.error("[S3CreateMultipart] Critical Handshake Failure:", err);
    return res.status(500).json({ 
      error: "Infrastructure Refusal", 
      message: err.message,
      code: err.code 
    });
  }
}