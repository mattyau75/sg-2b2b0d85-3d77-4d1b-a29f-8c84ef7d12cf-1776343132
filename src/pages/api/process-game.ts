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
    const { gameId, videoPath } = req.body;
    
    // Support both camelCase and snake_case
    const finalGameId = gameId || req.body.game_id;
    const finalVideoPath = videoPath || req.body.video_path;

    if (!finalGameId || !finalVideoPath) {
      return res.status(400).json({ 
        message: "Missing required game metadata (game_id or video_path)"
      });
    }

    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
      return res.status(500).json({ message: "CONFIG ERROR: R2_BUCKET_NAME missing." });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ message: "CREDENTIAL ERROR: Missing Supabase keys." });
    }

    // 1. RESOLVE R2 VIDEO KEY
    let primaryKey = finalVideoPath.trim();
    if (primaryKey.startsWith('/')) primaryKey = primaryKey.slice(1);
    
    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: primaryKey });
    const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 });

    // 2. INSTANT-ZERO LOGGING (Forensic Sync)
    // We use the exact column names from the schema: progress_percentage, status_message
    await supabase.from("game_analysis").upsert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 5,
      status_message: "🚀 ELITE IGNITION: Authorizing GPU Cluster..."
    }, { onConflict: "game_id" });

    await supabase.from("game_analysis").upsert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 10,
      status_message: "🔐 AUTH: Generating secure video payload & fresh Supabase keys..."
    }, { onConflict: "game_id" });

    // 3. PREPARE GPU PAYLOAD
    const gpuConfig = {
      game_id: finalGameId, 
      video_url: signedUrl,
      supabase_url: supabaseUrl,
      supabase_key: supabaseKey,
      pipeline_mode: "analyze"
    };

    await supabase.from("game_analysis").upsert({
      game_id: finalGameId,
      status: "dispatching",
      progress_percentage: 14,
      status_message: "📡 NETWORK: Handshaking with Modal GPU at verified endpoint..."
    }, { onConflict: "game_id" });

    // 4. TRIGGER GPU
    await modalService.processGame(finalGameId, {
      supabaseUrl,
      supabaseKey,
      metadata: gpuConfig
    });

    // 5. UPDATE GAME STATUS
    await supabase.from('games').update({ 
      status: 'analyzing', 
      progress_percentage: 15, 
      ignition_status: 'ignited',
      updated_at: new Date().toISOString()
    }).eq('id', finalGameId);

    return res.status(200).json({ success: true, gameId: finalGameId });
  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    
    // Log the crash in the trace
    await supabase.from("game_analysis").upsert({
      game_id: req.body.gameId || req.body.game_id,
      status: "failed",
      status_message: `❌ IGNITION ERROR: ${error.message}`
    }, { onConflict: "game_id" });

    return res.status(500).json({ message: error.message });
  }
}