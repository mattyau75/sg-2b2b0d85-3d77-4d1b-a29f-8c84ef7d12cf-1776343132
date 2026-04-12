import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { modalService } from "@/services/modalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. EXTRACT DATA IMMEDIATELY
  const { gameId, videoUrl, metadata } = req.body;
  const finalGameId = gameId || metadata?.gameId;

  if (!finalGameId) {
    return res.status(400).json({ message: "Missing required Game ID for ignition." });
  }

  try {
    // 🛡️ PRIME DIRECTIVE: ESTABLISH ETERNAL HANDSHAKE AS FIRST COMMAND
    const { error: handshakeError } = await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 1,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Started..."
    });

    if (handshakeError) {
      console.error("Prime Handshake Failed:", handshakeError);
      return res.status(500).json({ message: "Database Handshake Failure: " + handshakeError.message });
    }

    // 2. LOG SYSTEM VALIDATION
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 5,
      status_message: "🔐 AUTH: Verifying video payload & system integrity..."
    });

    if (!videoUrl) {
      throw new Error("Missing required video URL for AI processing.");
    }

    const videoFilename = videoUrl.split('/').pop() || 'game-video.mp4';

    // 3. PREPARE GPU PAYLOAD
    const gpuConfig = {
      game_id: finalGameId,
      video_url: videoUrl,
      video_filename: videoFilename,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      pipeline_mode: "analyze"
    };

    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "dispatching",
      progress_percentage: 14,
      status_message: "📡 NETWORK: Handshaking with Modal GPU at verified endpoint..."
    });

    // 4. TRIGGER GPU
    try {
      const modalResponse = await modalService.triggerAnalysis(gpuConfig);
      
      // LOG GPU AWAKENING (App Server side)
      await supabase.from("game_analysis").insert({
        game_id: finalGameId,
        status: "processing",
        progress_percentage: 15,
        status_message: "⚡ SYSTEM: GPU Cluster engaged. Handoff complete."
      });

      return res.status(200).json({ 
        message: "Ignition successful.",
        jobId: modalResponse?.job_id || finalGameId
      });

    } catch (gpuError: any) {
      console.error("GPU Trigger Error:", gpuError);
      throw new Error(`GPU Ignition Failed: ${gpuError.message || "Endpoint unreachable"}`);
    }

  } catch (error: any) {
    console.error("❌ IGNITION FAILURE:", error);
    
    // FORENSIC ERROR LOGGING: Push the error directly to the trace
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "error",
      progress_percentage: 0,
      status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown ignition failure"}`
    });

    return res.status(500).json({ message: error.message });
  }
}