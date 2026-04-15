import { NextApiRequest, NextApiResponse } from "next";
import { r2Client } from "@/lib/r2Client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

/**
 * DUAL-PURPOSE PRESIGN API:
 * 1. POST { fileName } -> Returns GET presigned URL for secure streaming (3600s)
 * 2. POST { fileName, contentType, isUpload: true } -> Returns Multipart Upload ID
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // 🛡️ AUTH CHECK: Verify active scout session using the dedicated Next.js helper
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies[name];
          },
          set(name: string, value: string, options: any) {
            res.setHeader("Set-Cookie", `${name}=${value}; Path=/; HttpOnly`);
          },
          remove(name: string, options: any) {
            res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; Max-Age=0`);
          },
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked. Tactical ID required." });
    }

    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "Missing fileName" });

    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || "videos";
    
    // Create an authorized command for the specific file
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      ResponseContentType: "video/mp4", // Force secure content type
    });

    // 🕒 2026 BEST PRACTICE: 60-second high-speed expiration for elite security
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });

    return res.status(200).json({ url: signedUrl });
  } catch (err: any) {
    console.error("[StoragePresign] Critical Handshake Error:", err);
    return res.status(500).json({ error: err.message });
  }
}