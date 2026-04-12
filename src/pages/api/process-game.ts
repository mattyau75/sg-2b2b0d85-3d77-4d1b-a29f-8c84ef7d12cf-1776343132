import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { modalService } from "@/services/modalService";

/**
 * PRIME IGNITION HANDLER
 * The gateway for Module 2: AI Discovery.
 * This handler is architected for the "Prime Handshake" first.
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. EXTRACT PARAMS
  const { gameId, videoUrl, metadata } = req.body;
  const finalGameId = gameId || metadata?.gameId;

  if (!finalGameId) {
    return res.status(400).json({ message: "Handshake Aborted: Missing Game Identity (ID)" });
  }

  try {
    // 🛡️ PRIME DIRECTIVE: THE ELITE ETERNAL HANDSHAKE
    // This is the absolute first command to run in the pipeline
    const { error: handshakeError } = await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 1,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Established."
    });

    if (handshakeError) {
      console.error("Prime Handshake Failed:", handshakeError);
      return res.status(500).json({ message: "Prime Handshake Failure: " + handshakeError.message });
    }

    // 2. SYSTEM VALIDATION LOG
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 5,
      status_message: "🔐 AUTH: Verifying system integrity and GPU permissions..."
    });

    if (!videoUrl) {
      throw new Error("Missing video payload. Handshake requires a valid S2/R2 URL.");
    }

    // 3. PREPARE SECURE GPU PAYLOAD
    const videoFilename = videoUrl.split('/').pop() || 'game-video.mp4';
    const gpuConfig = {
      game_id: finalGameId,
      video_url: videoUrl,
      video_filename: videoFilename,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY, // Dynamic handshake key
      pipeline_mode: "analyze"
    };

    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "dispatching",
      progress_percentage: 14,
      status_message: "📡 NETWORK: Handshaking with Modal GPU at verified endpoint..."
    });

    // 4. TRIGGER GPU IGNITION
    const modalResponse = await modalService.triggerAnalysis(gpuConfig);

    return res.status(200).json({ 
      message: "Prime Ignition Successful", 
      gpu_handshake: modalResponse 
    });

  } catch (error: any) {
    console.error("❌ PRIME IGNITION FAILURE:", error);
    
    // 🚨 EMERGENCY TRACE LOGGING: Log the failure immediately to the panel
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "error",
      progress_percentage: 0,
      status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown system failure"}`
    });

    return res.status(500).json({ message: error.message });
  }
}