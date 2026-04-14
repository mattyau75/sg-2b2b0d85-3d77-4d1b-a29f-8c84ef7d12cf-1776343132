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
    // 1. Precise Key Resolution
    // Cloudflare R2 keys are literal. We strip leading slashes to prevent // double-slash errors.
    const key = path.startsWith("/") ? path.substring(1) : path;
    
    console.log(`[R2 Handshake] Generating signed access for key: "${key}"`);

    // 2. Pre-sign the request
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: Number(expiry) });
    
    // 3. Success Handshake
    return res.status(200).json({ url });
  } catch (error: any) {
    console.error("[R2 Handshake] FAILURE:", error.message);
    return res.status(500).json({ 
      error: "Secure storage handshake failed",
      details: error.message,
      code: error.code || "UNKNOWN_S3_ERROR"
    });
  }
}