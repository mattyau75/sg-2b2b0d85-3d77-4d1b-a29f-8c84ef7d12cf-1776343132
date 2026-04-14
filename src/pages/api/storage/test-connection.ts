import { NextApiRequest, NextApiResponse } from "next";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0];
    
    const client = new S3Client({
      region: "us-east-1",
      endpoint: `https://${projectRef}.supabase.co/storage/v1/s3`,
      credentials: {
        accessKeyId: projectRef || "",
        secretAccessKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      forcePathStyle: true,
    });

    const command = new ListBucketsCommand({});
    const response = await client.send(command);

    return res.status(200).json({ 
      status: "connected", 
      buckets: response.Buckets?.map(b => b.Name),
      projectRef 
    });
  } catch (err: any) {
    return res.status(500).json({ 
      error: err.message, 
      code: err.code,
      details: "S3 Handshake Failed" 
    });
  }
}