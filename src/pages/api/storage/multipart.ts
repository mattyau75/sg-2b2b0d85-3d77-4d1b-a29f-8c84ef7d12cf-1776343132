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
      
      console.log(`[Multipart] Completing upload: ${uploadId} for key: ${key}`);
      console.log(`[Multipart] Received ${parts?.length} parts for reassembly`);

      if (!parts || !Array.isArray(parts)) {
        throw new Error("Invalid parts list provided for completion");
      }

      // Ensure ETags are correctly formatted and parts are sorted by part number
      const sortedParts = parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(p => ({
          ETag: p.etag.startsWith('"') ? p.etag : `"${p.etag}"`,
          PartNumber: p.partNumber
        }));

      const command = new CompleteMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts
        }
      });

      const result = await r2Client.send(command);
      console.log("[Multipart] Reassembly successful:", result.Location);
      
      return res.status(200).json({ success: true, location: result.Location });
    }

    return res.status(400).json({ message: "Invalid action" });
  } catch (error: any) {
    console.error("Multipart Error:", error);
    return res.status(500).json({ message: error.message });
  }
}