import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[API] ${req.method} /api/process-game triggered`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Force no-cache to prevent stale 404s from being cached by the browser
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
    
    if (!gameId || !videoPath) {
      return res.status(400).json({ message: "Missing required game metadata (ID or Video Path)" });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error("R2_BUCKET_NAME environment variable is missing");

    // Robust path sanitization:
    // 1. Remove leading slash if present
    // 2. Decode URL characters (in case the path was stored as a full URL)
    // 3. Remove "games/" prefix if it was accidentally doubled
    let sanitizedPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
    try { sanitizedPath = decodeURIComponent(sanitizedPath); } catch (e) {}
    
    // Final key should not have the protocol or domain if it was passed as a full URL
    if (sanitizedPath.includes('://')) {
      const url = new URL(sanitizedPath);
      sanitizedPath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }

    console.log(`[ProcessGame] Verifying R2 Key: ${sanitizedPath}`);

    // Verify file existence in R2
    try {
      await r2Client.send(new HeadObjectCommand({ 
        Bucket: bucketName, 
        Key: sanitizedPath 
      }));
    } catch (e: any) {
      console.error(`[ProcessGame] File Check Failed for key: ${sanitizedPath}`, e.message);
      return res.status(404).json({ 
        message: `Video file not found in storage. Checked key: ${sanitizedPath}`,
        path: sanitizedPath
      });
    }

    // Generate a temporary signed URL for the GPU worker (valid for 24h)
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: sanitizedPath });
    const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 });

    // Fetch team rosters for mapping
    const [{ data: homeRoster }, { data: awayRoster }, { data: gameData }] = await Promise.all([
      supabase.from('players').select('id, name, number').eq('team_id', homeTeamId),
      supabase.from('players').select('id, name, number').eq('team_id', awayTeamId),
      supabase.from('games').select('camera_type').eq('id', gameId).single()
    ]);

    const gpuConfig = {
      game_id: gameId, 
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      homeColor,
      awayColor,
      camera_type: gameData?.camera_type || "panning",
      home_roster: homeRoster || [],
      away_roster: awayRoster || [],
      scouting_mode: "deep_recognition",
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    // Update game status to signify ingestion start
    await supabase.from('games').update({ 
      status: 'analyzing', 
      progress_percentage: 10, 
      ignition_status: 'ignited',
      updated_at: new Date().toISOString(),
      last_error: null
    } as any).eq('id', gameId);

    // Fire and forget GPU handoff
    modalService.processGame(signedUrl, { game_id: gameId, ...gpuConfig }).catch(err => {
      console.error("[ProcessGame] GPU Handoff Failed:", err.message);
      supabase.from('games').update({ 
        status: 'error', 
        last_error: `GPU Connection Failed: ${err.message}`,
        ignition_status: 'failed'
      } as any).eq('id', gameId);
    });

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