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
      supabase.from('players').select('id, name, number').eq('team_id', homeTeamId),
      supabase.from('players').select('id, name, number').eq('team_id', awayTeamId)
    ]);

    // 4. TRIGGER GPU CLUSTER
    const gpuConfig = {
      game_id: gameId, 
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      homeColor,
      awayColor,
      home_roster: homeRoster || [],
      away_roster: awayRoster || [],
      scouting_mode: "deep_recognition",
      roster_sync: true,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    console.log(`[ProcessGame] Dispatching Ignition Signal for ${gameId}`);
    
    // 0. WARM UP CONNECTION: Verify we can still see the game
    const { data: activeGame } = await supabase.from('games').select('id').eq('id', gameId).single();
    if (!activeGame) throw new Error("Game record lost during ignition sequence");

    // 1. LOCAL PULSE INJECTION: Force 25% progress locally
    console.log(`[ProcessGame] Injecting Ignition Pulse for game: ${gameId}`);
    await supabase
      .from('games')
      .update({ 
        status: 'analyzing', 
        progress_percentage: 25,
        ignition_status: 'ignited',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    // 2. DETACHED GPU TRIGGER: Fire and forget to prevent timeouts
    console.log(`[ProcessGame] Dispatching to GPU Swarm...`);
    modalService.processGame(signedUrl, {
      game_id: gameId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      homeColor,
      awayColor,
      home_roster: homeRoster || [],
      away_roster: awayRoster || [],
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }).catch(err => {
      console.error("[ProcessGame] GPU Handoff Failed:", err.message);
      supabase.from('games').update({ 
        status: 'error', 
        last_error: `GPU Connection Failed: ${err.message}` 
      }).eq('id', gameId);
    });

    // 3. IMMEDIATE RETURN: Confirm handoff to UI
    return res.status(202).json({ 
      success: true, 
      message: "Ignition Sequence Started",
      id: gameId 
    });

  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}