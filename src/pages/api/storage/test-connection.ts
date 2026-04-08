import type { NextApiRequest, NextApiResponse } from "next";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2Client } from "@/lib/r2Client";

/**
 * Diagnostic endpoint to verify R2 API connectivity.
 * Only intended for troubleshooting and should be removed before production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  try {
    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
    
    // Check if variables exist
    const missing = [];
    if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
    if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
    if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");

    if (missing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing environment variables", 
        missing 
      });
    }

    // Attempt a simple ListObjectsV2 call (max 1 key) to verify connection
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1
    });

    await r2Client.send(command);

    return res.status(200).json({ 
      success: true, 
      message: `SUCCESS: Connection established to R2 bucket: ${bucketName}` 
    });

  } catch (error: any) {
    console.error("R2 Connection Test Failed:", error);
    return res.status(500).json({ 
      success: false, 
      message: "R2 Connection Failed",
      error: error.message,
      code: error.code || error.$metadata?.httpStatusCode
    });
  }
}