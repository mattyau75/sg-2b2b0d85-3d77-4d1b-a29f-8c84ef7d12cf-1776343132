import type { NextApiRequest, NextApiResponse } from "next";
import { r2Client, BUCKET_NAME } from "@/lib/r2Client";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1000
    });
    
    const { Contents } = await r2Client.send(command);
    const files = Contents?.map(c => ({
      key: c.Key,
      size: c.Size,
      lastModified: c.LastModified
    })) || [];

    return res.status(200).json({ 
      bucket: BUCKET_NAME,
      count: files.length,
      files 
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}