import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("R2_BUCKET_NAME environment variable is missing");
    }

    // Sanitize videoPath: remove leading slash if present
    const sanitizedPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;

    console.log(`[ProcessGame] Starting analysis for Game: ${gameId}`);
    
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
        lastR2Error = { name: e.name, message: e.message };
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    if (!fileFound) {
      return res.status(500).json({ 
        message: "R2 Verification Failed", 
        details: lastR2Error,
        path: sanitizedPath
      });
    }

    // 2. TRIGGER GPU ANALYSIS
    await modalService.processGame(sanitizedPath, {
      gameId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_team_color: homeColor,
      away_team_color: awayColor
    });

    // 3. UPDATE DB
    await supabase.from('games').update({ status: 'processing' }).eq('id', gameId);

    return res.status(200).json({ success: true, message: "Analysis started" });

  } catch (error: any) {
    console.error("[ProcessGame] Critical Failure:", error.message);
    return res.status(500).json({ 
      message: "Internal Processing Error", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}