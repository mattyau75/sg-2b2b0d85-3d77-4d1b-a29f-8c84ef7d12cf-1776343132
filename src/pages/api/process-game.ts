import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("R2_BUCKET_NAME environment variable is missing");
    }

    // 1. SANITIZE & VERIFY FILE
    const sanitizedPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
    
    try {
      await r2Client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: sanitizedPath,
      }));
    } catch (e: any) {
      return res.status(404).json({ message: "Video file not found in storage", path: sanitizedPath });
    }

    // 2. GENERATE PERSISTENT SIGNED URL (24H)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: sanitizedPath,
    });
    const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 });

    // 3. FETCH ROSTERS FOR DEEP RECOGNITION
    const [{ data: homeRoster }, { data: awayRoster }] = await Promise.all([
      supabase.from('players').select('name, number').eq('team_id', homeTeamId),
      supabase.from('players').select('name, number').eq('team_id', awayTeamId)
    ]);

    // 4. TRIGGER GPU CLUSTER
    const gpuConfig = {
      gameId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      homeColor,
      awayColor,
      home_roster: homeRoster || [],
      away_roster: awayRoster || [],
      scouting_mode: "deep_recognition",
      roster_sync: true
    };

    console.log(`[ProcessGame] Handing off to GPU Swarm for ${gameId}`);
    
    // Update status to processing immediately before triggering
    await supabase.from('games').update({ 
      status: 'processing',
      progress_percentage: 10 
    }).eq('id', gameId);

    // Trigger but don't wait for completion to allow background execution
    modalService.processGame(signedUrl, gpuConfig).catch(err => {
      console.error("[ProcessGame] Background GPU Trigger Failed:", err.message);
      supabase.from('games').update({ 
        status: 'error', 
        last_error: `GPU Handoff Failed: ${err.message}` 
      }).eq('id', gameId);
    });

    return res.status(200).json({ success: true, message: "AI Mapping Started in Background" });

  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}