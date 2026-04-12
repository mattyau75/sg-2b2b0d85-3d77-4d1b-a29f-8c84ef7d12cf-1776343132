import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { modalService } from "@/services/modalService";

/**
 * ELITE IGNITION API: The Prime Handshake Gatekeeper
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ EXTRACT PAYLOAD IMMEDIATELY
  const { gameId, videoUrl, metadata } = req.body;
  const finalGameId = gameId || metadata?.gameId || metadata?.id;

  if (!finalGameId) {
    return res.status(400).json({ 
      message: "❌ CRITICAL SYSTEM STALL: Missing required Game ID for ignition." 
    });
  }

  try {
    // 🤝 PRIME HANDSHAKE: THE VERY FIRST OPERATIONAL COMMAND
    const { error: handshakeError } = await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 1,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Started..."
    });

    if (handshakeError) {
      console.error("Prime Handshake Failed:", handshakeError);
      throw new Error(`Database Handshake Failure: ${handshakeError.message}`);
    }

    // 2. SYSTEM INTEGRITY CHECK
    if (!videoUrl) {
      throw new Error("Missing required video URL for AI discovery.");
    }

    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 10,
      status_message: "🔐 AUTH: Synchronizing credentials with GPU cluster..."
    });

    // 3. TRIGGER TRI-DIRECTIONAL HANDSHAKE (API -> GPU)
    await modalService.triggerAnalysis({
      gameId: finalGameId,
      videoUrl: videoUrl,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      metadata: metadata
    });

    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "dispatching",
      progress_percentage: 14,
      status_message: "📡 NETWORK: Handshake received by Modal. GPU Awakening..."
    });

    return res.status(200).json({ success: true, gameId: finalGameId });

  } catch (error: any) {
    console.error("❌ IGNITION FAILURE:", error);
    
    // FORENSIC ERROR BROADCAST
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "error",
      progress_percentage: 0,
      status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown ignition failure"}`
    });

    return res.status(500).json({ message: error.message });
  }
}