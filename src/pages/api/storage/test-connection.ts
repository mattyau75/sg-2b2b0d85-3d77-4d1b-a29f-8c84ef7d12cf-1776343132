import type { NextApiRequest, NextApiResponse } from "next";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2Client } from "@/lib/r2Client";
import { supabase } from "@/integrations/supabase/client";

/**
 * Advanced diagnostic endpoint to audit R2 storage contents.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  try {
    const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
    
    // 1. Check for missing credentials
    const missing = [];
    if (!process.env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
    if (!process.env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
    if (!process.env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");

    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: "Missing R2 Environment Variables", missing });
    }

    // 2. Check for Placeholder Service Role Key
    const serviceRoleValid = process.env.SUPABASE_SERVICE_ROLE_KEY && 
                            !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('-8Z-8Z') &&
                            process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50;
    
    // 3. Test R2 Connection
    let r2Connected = false;
    try {
      const command = new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 });
      await r2Client.send(command);
      r2Connected = true;
    } catch (e) {
      console.error("R2 Connection Test Failed:", e);
    }

    return res.status(200).json({ 
      success: true, 
      supabase_service_role: serviceRoleValid,
      r2_connected: r2Connected,
      bucket: bucketName,
      diagnostics: {
        supabase_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) + "..." : "MISSING",
        r2_acc_prefix: process.env.R2_ACCOUNT_ID ? process.env.R2_ACCOUNT_ID.substring(0, 5) + "..." : "MISSING",
        r2_key_prefix: process.env.R2_ACCESS_KEY_ID ? process.env.R2_ACCESS_KEY_ID.substring(0, 5) + "..." : "MISSING"
      }
    });

  } catch (error: any) {
    console.error("R2 Storage Audit Failed:", error);
    return res.status(500).json({ 
      success: false, 
      message: "R2 Storage Audit Failed",
      error: error.message,
      code: error.$metadata?.httpStatusCode
    });
  }
}