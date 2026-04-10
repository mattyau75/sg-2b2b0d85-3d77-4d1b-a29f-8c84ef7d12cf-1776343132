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
    
    // 1. EAGER UPDATE: Mark as analyzing/15% immediately to signal successful dispatch
    await supabase.from('games').update({ 
      status: 'analyzing',
      progress_percentage: 15,
      processing_metadata: {
        ...(req.body.processing_metadata || {}),
        gpu_triggered_at: new Date().toISOString()
      }
    }).eq('id', gameId);

    // 2. TRIGGER & DETACH: Fire the request without awaiting the stream
    // This prevents the API from hanging for 10+ minutes on the worker's StreamingResponse
    modalService.processGame(signedUrl, gpuConfig).then(() => {
      console.log(`[ProcessGame] GPU Job Completed for ${gameId}`);
    }).catch(err => {
      console.error("[ProcessGame] GPU Handoff or Execution Failed:", err.message);
      // Only update to error if we're not already marked as completed by the worker
      supabase.from('games').select('status').eq('id', gameId).single().then(({ data }) => {
        if (data?.status !== 'completed') {
          supabase.from('games').update({ 
            status: 'error', 
            last_error: `AI Engine Error: ${err.message}` 
          }).eq('id', gameId).then(() => {});
        }
      });
    });

    // 3. Return 202 Accepted immediately
    return res.status(202).json({ 
      success: true, 
      message: "AI Mapping Ignited",
      jobId: gameId 
    });

  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}