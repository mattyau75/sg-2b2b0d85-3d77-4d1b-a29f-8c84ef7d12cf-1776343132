import type { NextApiRequest, NextApiResponse } from "next";
import { 
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand 
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client } from "@/lib/r2Client";

/**
 * API for managing large file Multipart Uploads (8GB+ support)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";

  try {
    if (action === "create") {
      const { filename, contentType } = req.body;
      const key = `videos/${Date.now()}-${filename.replace(/\s+/g, "_")}`;
      
      const command = new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      });

      const response = await r2Client.send(command);
      return res.status(200).json({ uploadId: response.UploadId, key });
    }

    if (action === "sign-part") {
      const { uploadId, key, partNumber } = req.body;
      
      const command = new UploadPartCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
      return res.status(200).json({ url });
    }

    if (action === "complete") {
      const { uploadId, key, parts } = req.body;
      
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p: any) => ({
            ETag: p.etag,
            PartNumber: p.partNumber,
          })),
        },
      });

      await r2Client.send(command);
      return res.status(200).json({ success: true, key });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error: any) {
    console.error("Multipart Error:", error);
    return res.status(500).json({ message: error.message });
  }
}