import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, BUCKET_NAME } from "@/lib/r2Client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ message: "Path is required" });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: path as string,
    });

    // Increase expiry to 24 hours to ensure long analysis jobs don't time out on the URL
    const url = await getSignedUrl(r2Client, command, { expiresIn: 86400 });

    return res.status(200).json({ url });
  } catch (error: any) {
    console.error("[SignedUrl] Error generating URL:", error);
    return res.status(500).json({ message: error.message });
  }
}