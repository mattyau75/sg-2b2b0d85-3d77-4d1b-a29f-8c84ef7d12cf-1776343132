import type { NextApiRequest, NextApiResponse } from "next";
import { r2Client, R2_BUCKET } from "@/lib/r2Client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { filename, contentType } = req.body;

    // Validate environment variables before attempting to use the client
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ACCOUNT_ID) {
      console.error("Missing R2 Environment Variables");
      return res.status(500).json({ 
        error: "Configuration Error", 
        details: "R2 Environment variables are missing in Settings > Environment" 
      });
    }

    const key = `videos/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    res.status(200).json({ uploadUrl });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}