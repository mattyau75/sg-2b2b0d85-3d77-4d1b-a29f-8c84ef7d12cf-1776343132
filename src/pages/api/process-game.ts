import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
  const bucketName = process.env.R2_BUCKET_NAME;

  // Sanitize videoPath: remove leading slash if present
  const sanitizedPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;

  console.log(`[ProcessGame] ===== Starting GPU Analysis =====`);
  console.log(`[ProcessGame] Game ID: ${gameId}`);
  console.log(`[ProcessGame] Video Path (raw): ${videoPath}`);
  console.log(`[ProcessGame] Video Path (sanitized): ${sanitizedPath}`);
  console.log(`[ProcessGame] Bucket Name: ${bucketName}`);
  console.log(`[ProcessGame] R2 Client Config:`, {
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY
  });

  try {
    // Increased to 5 retries with 3s delay (15s total) for 8GB+ files
    let fileFound = false;
    let lastError = null;

    for (let i = 0; i < 5; i++) {
      try {
        console.log(`[ProcessGame] Verification attempt ${i + 1}/5...`);
        const headResult = await r2Client.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: sanitizedPath,
        }));
        fileFound = true;
        console.log(`[ProcessGame] ✅ File verified on attempt ${i + 1}`);
        console.log(`[ProcessGame] File metadata:`, {
          ContentLength: headResult.ContentLength,
          ContentType: headResult.ContentType,
          LastModified: headResult.LastModified
        });
        break;
      } catch (e: any) {
        lastError = e;
        console.error(`[ProcessGame] ❌ Verification attempt ${i + 1} failed:`);
        console.error(`[ProcessGame] Error Name: ${e.name}`);
        console.error(`[ProcessGame] Error Message: ${e.message}`);
        console.error(`[ProcessGame] Error Code: ${e.$metadata?.httpStatusCode}`);
        console.error(`[ProcessGame] Full Error:`, JSON.stringify(e, null, 2));
        
        if (i < 4) {
          console.log(`[ProcessGame] Waiting 3s before retry...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (!fileFound) {
      console.error(`[ProcessGame] ===== VERIFICATION FAILED =====`);
      console.error(`[ProcessGame] Final Error:`, lastError);
      return res.status(500).json({ 
        message: `Failed to verify R2 video file after 5 attempts.`,
        details: {
          errorName: lastError?.name,
          errorMessage: lastError?.message,
          videoPath: sanitizedPath,
          bucket: bucketName
        }
      });
    }

    console.log("[ProcessGame] File verified successfully. Generating GPU payload...");

    // Update game status to processing
    const { error: updateError } = await supabase
      .from('games')
      .update({ status: 'processing' })
      .eq('id', gameId);

    if (updateError) {
      console.error("[ProcessGame] Database update failed:", updateError);
      throw updateError;
    }

    // Trigger Modal.com GPU analysis
    console.log("[ProcessGame] Triggering Modal.com GPU pipeline...");
    await modalService.processGame(sanitizedPath, {
      gameId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_team_color: homeColor,
      away_team_color: awayColor
    });

    console.log("[ProcessGame] ===== GPU Analysis Triggered Successfully =====");
    return res.status(200).json({ success: true, message: "Analysis started" });

  } catch (error: any) {
    console.error("[ProcessGame] ===== CRITICAL ERROR =====");
    console.error("[ProcessGame] Error:", error);
    return res.status(500).json({ message: error.message });
  }
}