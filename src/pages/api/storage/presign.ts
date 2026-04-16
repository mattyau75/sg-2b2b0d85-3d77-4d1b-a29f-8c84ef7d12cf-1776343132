import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

/**
 * DUAL-PURPOSE PRESIGN API:
 * 1. POST { fileName } -> Returns GET presigned URL for secure streaming (3600s)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 🛡️ AUTH CHECK: Using createServerClient for Pages Router compatibility in this version
    const supabase = createServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error("[Presign] Unauthorized: No session found in cookies");
      return res.status(401).json({ 
        error: "Unauthorized access blocked. Tactical ID required."
      });
    }

    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "Missing fileName" });

    // 🕒 Resolve environment variables
    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || "videos";
    
    // Create an authorized command for the specific file
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ResponseContentType: "video/mp4",
    });

    // 🕒 60-second high-speed expiration for elite security
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });

    return res.status(200).json({ url: signedUrl });
  } catch (err: any) {
    console.error("[StoragePresign] Critical Handshake Error:", err);
    return res.status(500).json({ error: err.message });
  }
}