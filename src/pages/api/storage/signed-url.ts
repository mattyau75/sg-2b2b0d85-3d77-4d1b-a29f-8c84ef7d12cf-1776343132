import type { NextApiRequest, NextApiResponse } from "next";
import { r2Client, R2_BUCKET } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ message: "Path is required" });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.status(200).json({ url });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}