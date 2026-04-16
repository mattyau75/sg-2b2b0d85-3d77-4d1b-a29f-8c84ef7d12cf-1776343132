import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 🛡️ SECURITY HANDSHAKE
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return req.cookies[name]; },
          set(name: string, value: string, options: any) { res.setHeader("Set-Cookie", `${name}=${value}`); },
          remove(name: string, options: any) { res.setHeader("Set-Cookie", `${name}=; Max-Age=0`); },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      logger.error("[Presign] Unauthorized access attempt");
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "Missing fileName" });

    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || "dribblestats-storage";
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ResponseContentType: "video/mp4",
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });

    return res.status(200).json({ url: signedUrl });
  } catch (err: any) {
    logger.error("[StoragePresign] Critical Handshake Error", err);
    return res.status(500).json({ error: err.message });
  }
}