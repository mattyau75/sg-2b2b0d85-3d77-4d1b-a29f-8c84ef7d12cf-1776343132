import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, BUCKET_NAME } from "@/lib/r2Client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, expiry = 3600 } = req.query;

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: "Missing video path" });
  }

  try {
    // Generate signed URL for Cloudflare R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: path,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: Number(expiry) });
    return res.status(200).json({ url });
  } catch (error: any) {
    console.error("[SignedURL API] Error generating access token:", error);
    return res.status(500).json({ error: "Secure storage handshake failed" });
  }
}