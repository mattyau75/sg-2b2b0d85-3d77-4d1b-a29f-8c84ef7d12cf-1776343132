import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Test connection by listing Supabase Storage buckets
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    const videosBucketExists = data.some(bucket => bucket.name === 'videos');

    return res.status(200).json({
      status: "success",
      message: "Supabase Storage connection successful",
      buckets: data.map(b => b.name),
      videosBucketReady: videosBucketExists
    });
  } catch (error: any) {
    console.error("Storage connection test failed:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to connect to Supabase Storage",
      details: error.message
    });
  }
}