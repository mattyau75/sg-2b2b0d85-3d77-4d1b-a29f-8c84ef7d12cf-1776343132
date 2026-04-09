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

  console.log(`[ProcessGame] Starting analysis for Game: ${gameId}`);
  
  try {
    // 1. VERIFY FILE EXISTS IN R2
    let fileFound = false;
    let lastR2Error = null;

    for (let i = 0; i < 5; i++) {
      try {
        await r2Client.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: sanitizedPath,
        }));
        fileFound = true;
        break;
      } catch (e: any) {
        lastR2Error = {
          name: e.name,
          message: e.message,
          code: e.$metadata?.httpStatusCode
        };
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (!fileFound) {
      return res.status(500).json({ 
        message: "R2 Verification Failed", 
        step: "R2_CHECK",
        error: lastR2Error,
        path: sanitizedPath,
        bucket: bucketName
      });
    }

    // 2. TRIGGER GPU ANALYSIS
    try {
      await modalService.processGame(sanitizedPath, {
        gameId,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_team_color: homeColor,
        away_team_color: awayColor
      });
    } catch (modalError: any) {
      // Set status to error if trigger fails
      await supabase.from('games').update({ status: 'error' }).eq('id', gameId);
      
      return res.status(500).json({ 
        message: "GPU Trigger Failed", 
        step: "MODAL_TRIGGER",
        error: modalError.response?.data || modalError.message,
        webhook: process.env.MODAL_WEBHOOK_URL ? "Configured" : "MISSING"
      });
    }

    return res.status(200).json({ success: true, message: "Analysis started" });

  } catch (error: any) {
    return res.status(500).json({ 
      message: "Critical Server Error", 
      step: "UNCAUGHT",
      error: error.message 
    });
  }
}