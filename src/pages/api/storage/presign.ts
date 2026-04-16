import type { NextApiRequest, NextApiResponse } from "next";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/s3Client";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies).map((name) => ({
            name,
            value: req.cookies[name] || '',
          }));
        },
        setAll(cookiesToSet) {
          try {
            const setCookieHeaders = cookiesToSet.map(({ name, value, options }) =>
              serialize(name, value, options)
            );
            if (setCookieHeaders.length > 0) {
              res.setHeader('Set-Cookie', setCookieHeaders);
            }
          } catch (error) {
            // Ignore if headers already sent
          }
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { fileName, fileType } = req.body;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `videos/${fileName}`,
      ContentType: fileType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({ url });
  } catch (error: any) {
    console.error("Presign error:", error);
    res.status(500).json({ error: error.message });
  }
}