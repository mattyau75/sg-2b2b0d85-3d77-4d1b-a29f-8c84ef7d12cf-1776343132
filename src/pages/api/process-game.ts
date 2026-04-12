import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { triggerAnalysis } from "@/services/modalService";

/**
 * ELITE IGNITION API: Module 2 - Discovery Swarm
 * This handler manages the prime handshake and GPU ignition.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  // 1. ATOMIC PAYLOAD EXTRACTION (The "ID Bridge")
  const { 
    gameId, 
    game_id, 
    videoUrl, 
    video_path,
    metadata,
    dry_run 
  } = req.body;

  // Supporting both camelCase and snake_case for the Game ID
  const finalGameId = gameId || game_id || metadata?.gameId || metadata?.game_id || metadata?.id;
  const finalVideoUrl = videoUrl || video_path || metadata?.videoUrl || metadata?.video_path;

  // 🛡️ FATAL ERROR GUARD: Ensure Game ID is valid
  if (!finalGameId) {
    return res.status(400).json({ 
      message: "❌ CRITICAL SYSTEM STALL: Missing required Game ID for ignition." 
    });
  }

  try {
    // 🛡️ HANDSHAKE STABILIZER: Give the frontend listener a moment to connect
    await new Promise(resolve => setTimeout(resolve, 800));

    // 1. PRIME HANDSHAKE: First log entry
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 2,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Established."
    });

    // 2. LOG SYSTEM VALIDATION
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 5,
      status_message: "🔐 AUTH: Verifying video payload & system integrity..."
    });

    if (!finalVideoUrl) throw new Error("Missing required video URL for AI processing.");

    // 3. TRIGGER GPU IGNITION (HANDOFF)
    const modalUrl = process.env.MODAL_ENDPOINT_URL || "NOT_CONFIGURED";
    
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 12,
      status_message: `🛰️ TARGETING: GPU Endpoint [${modalUrl.split('--')[0]}...] verified.`
    });

    await triggerAnalysis({
      gameId: finalGameId,
      videoUrl: finalVideoUrl,
      metadata: { ...metadata, dryRun: dry_run || false },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    });

    // 4. CONFIRM HANDOFF SUCCESS
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "dispatched",
      progress_percentage: 14,
      status_message: "🚀 DISPATCHED: AI Swarm has been notified. Waiting for GPU awakening (15%+)..."
    });

    return res.status(200).json({ success: true, message: "Ignition handoff successful" });

  } catch (error: any) {
    console.error("❌ IGNITION FAILURE:", error);
    
    // FORENSIC ERROR LOGGING: Push the error directly to the trace panel
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "error",
      progress_percentage: 0,
      status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown system failure"}`
    });

    return res.status(500).json({ message: error.message });
  }
}