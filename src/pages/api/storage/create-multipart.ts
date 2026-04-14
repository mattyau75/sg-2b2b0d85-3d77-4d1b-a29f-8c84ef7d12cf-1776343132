import { NextApiRequest, NextApiResponse } from "next";
import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType } = req.body;
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0];
    
    if (!projectRef) throw new Error("Missing Supabase Project Reference");

    const client = new S3Client({
      region: "us-east-1",
      endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
      credentials: {
        accessKeyId: projectRef,
        secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      forcePathStyle: true,
    });

    const key = `videos/${Date.now()}-${fileName}`;
    const command = new CreateMultipartUploadCommand({
      Bucket: "videos",
      Key: key,
      ContentType: contentType,
    });

    const { UploadId, Key } = await client.send(command);
    
    return res.status(200).json({ uploadId: UploadId, key: Key });
  } catch (err: any) {
    console.error("[StorageMultipart] Initial Handshake Failed:", err.message);
    return res.status(500).json({ 
      error: "S3 Handshake Failed", 
      message: err.message 
    });
  }
}