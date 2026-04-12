import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[API] ${req.method} /api/process-game triggered`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Force no-cache to prevent stale 404s
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
    
    // Support both camelCase and snake_case
    const finalGameId = gameId || req.body.game_id;
    const finalVideoPath = videoPath || req.body.video_path;

    if (!finalGameId || !finalVideoPath) {
      return res.status(400).json({ 
        message: "Missing required game metadata (game_id or video_path)",
        received: { gameId: !!finalGameId, videoPath: !!finalVideoPath }
      });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      return res.status(500).json({ message: "CONFIG ERROR: R2_BUCKET_NAME environment variable is missing from App Server." });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ message: "CREDENTIAL ERROR: SUPABASE_SERVICE_ROLE_KEY is missing from App Server environment." });
    }

    // Robust path resolution logic
    // We will try several variations of the key to ensure we find the file
    let primaryKey = finalVideoPath.trim();
    
    // 1. Decode URL characters
    try { primaryKey = decodeURIComponent(primaryKey); } catch (e) {}
    
    // 2. Extract key from full URL if passed
    if (primaryKey.includes('://')) {
      const url = new URL(primaryKey);
      primaryKey = url.pathname;
    }

    // 3. Remove leading slash
    if (primaryKey.startsWith('/')) primaryKey = primaryKey.slice(1);

    const keysToTry = [
      primaryKey,
      `videos/${primaryKey.split('/').pop()}`, 
      `raw-footage/${primaryKey.split('/').pop()}`,
      primaryKey.replace('raw-footage/', 'videos/')
    ];

    let confirmedKey = "";
    console.log(`[ProcessGame] Starting resolution for key variations:`, keysToTry);

    // TRY EVERY POSSIBLE COMBINATION
    const aggressiveKeys = [
      ...keysToTry,
      primaryKey.split('/').pop() || ""
    ].filter(Boolean);

    for (const key of aggressiveKeys) {
      try {
        await r2Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
        confirmedKey = key;
        console.log(`[ProcessGame] ✅ Verified R2 Key for GPU: ${key}`);
        break;
      } catch (e) {}
    }

    // FINAL FALLBACK: Scan 'videos/' folder specifically for the filename part
    if (!confirmedKey) {
      console.log(`[ProcessGame] 🔍 SCANNING 'videos/' FOLDER for filename match`);
      const listAll = await r2Client.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: "videos/" }));
      const fileNamePart = primaryKey.split('-').pop() || primaryKey;
      const match = listAll.Contents?.find(obj => obj.Key?.includes(fileNamePart));
      if (match?.Key) {
        confirmedKey = match.Key;
        console.log(`[ProcessGame] 🎯 Found in videos/ via partial match: ${confirmedKey}`);
      }
    }

    if (!confirmedKey) {
      return res.status(404).json({ 
        message: `Video file not found in storage. Checked keys: ${keysToTry.join(', ')}`,
        triedKeys: keysToTry
      });
    }

    // Generate a temporary signed URL for the GPU worker (valid for 24h)
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: confirmedKey });
    const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 });

    // Fetch team rosters for mapping
    const [{ data: homeRoster }, { data: awayRoster }, { data: gameData }] = await Promise.all([
      supabase.from('players').select('id, name, number').eq('team_id', homeTeamId),
      supabase.from('players').select('id, name, number').eq('team_id', awayTeamId),
      supabase.from('games').select('camera_type').eq('id', finalGameId).single()
    ]);

    // Extract a clean filename for the GPU Volume lookup
    const rawFilename = confirmedKey.split('/').pop() || "footage.mp4";
    const videoFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

    const gpuConfig = {
      game_id: finalGameId, 
      video_url: signedUrl,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY, // DIRECT MASTER HANDSHAKE
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_roster: homeRoster || [],
      away_roster: awayRoster || []
    };

    // LAUNCHER MODE: Trigger the GPU and immediately release the request
    modalService.processGame(signedUrl, gpuConfig).catch(err => {
      console.error("[ProcessGame] Launch Failure:", err);
    });

    // Return instantly to keep the UI 'alive' and responsive
    return res.status(202).json({ success: true, message: "GPU Discovery Launched" });
  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}