import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ message: "Path is required" });
  }

  try {
    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: path as string,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.status(200).json({ url });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}