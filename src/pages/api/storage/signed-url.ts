import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path, expiry = 3600 } = req.query;

  if (!path || typeof path !== "string") {
    return res.status(400).json({ error: "Missing video path" });
  }

  try {
    // Sanitize path: remove leading slashes and common prefixes if they are already in the bucket root
    const sanitizedPath = path.replace(/^\/+/, "");
    
    console.log(`[SignedURL API] Generating handshake for key: ${sanitizedPath}`);

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: sanitizedPath,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: Number(expiry) });
    return res.status(200).json({ url });
  } catch (error: any) {
    console.error("[SignedURL API] Secure Handshake Failure:", error);
    return res.status(500).json({ 
      error: "Secure storage handshake failed",
      details: error.message 
    });
  }
}