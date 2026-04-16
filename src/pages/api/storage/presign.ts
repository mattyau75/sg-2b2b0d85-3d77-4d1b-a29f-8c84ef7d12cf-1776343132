import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

/**
 * ELITE VIDEO BRIDGE: SECURE STREAMING HANDSHAKE
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 🛡️ SECURITY HANDSHAKE: Standardized 1-arg signature for Pages Router
    const supabase = createServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      logger.error("[Presign] Unauthorized access attempt - No session found");
      return res.status(401).json({ error: "Unauthorized access blocked. Tactical ID required." });
    }

    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "Missing fileName" });

    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || "dribblestats-storage";
    
    logger.info(`[Presign] Generating tactical link`, { fileName, bucket: bucketName });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ResponseContentType: "video/mp4",
    });

    // 3600-second window for tactical playback security
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return res.status(200).json({ url: signedUrl });
  } catch (err: any) {
    logger.error("[StoragePresign] Critical Handshake Error", err);
    return res.status(500).json({ error: err.message });
  }
}