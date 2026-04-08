import type { NextApiRequest, NextApiResponse } from "next";
import { r2Client, R2_BUCKET } from "@/lib/r2Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { fileName, contentType } = req.body;

  try {
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.status(200).json({ uploadUrl });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}