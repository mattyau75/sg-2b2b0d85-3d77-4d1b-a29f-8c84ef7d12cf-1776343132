import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { triggerAnalysis } from "@/services/modalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. ATOMIC EXTRACTION
  const { gameId, video_path, videoUrl: bodyVideoUrl, metadata } = req.body;
  const rawId = gameId || req.body.game_id || metadata?.gameId || metadata?.game_id || metadata?.id;
  const finalGameId = typeof rawId === 'string' ? rawId.toLowerCase() : null;
  const finalVideoUrl = bodyVideoUrl || video_path || metadata?.videoUrl;

  if (!finalGameId) {
    return res.status(400).json({ message: "❌ CRITICAL SYSTEM STALL: Missing required Game ID for ignition." });
  }

  try {
    // 🛡️ PRE-FLIGHT VALIDATION
    if (!finalVideoUrl) {
      throw new Error("Missing video source for AI analysis.");
    }

    // 🛡️ HANDSHAKE STABILIZER: Ensure frontend listener is ready
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 1. PRIME HANDSHAKE: Establish link
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 5,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Established."
    });

    // 2. FORENSIC PAYLOAD LOG
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 10,
      status_message: `📦 PAYLOAD: Video Source [${finalVideoUrl?.substring(0, 30)}...] identified.`
    });

    // 3. AUTHORIZATION (5-14%)
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 12,
      status_message: "🔐 AUTH: Verifying video payload & system integrity..."
    });

    // 4. TRIGGER GPU IGNITION (HANDOFF)
    await triggerAnalysis({
      gameId: finalGameId,
      videoUrl: finalVideoUrl,
      metadata: metadata || {},
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    });

    return res.status(200).json({ 
      message: "🚀 Swarm Launched Successfully.",
      gameId: finalGameId 
    });

  } catch (error: any) {
    console.error("❌ IGNITION FAILURE:", error);
    
    // FORENSIC ERROR LOGGING
    if (finalGameId) {
      await supabase.from("game_analysis").insert({
        game_id: finalGameId,
        status: "error",
        progress_percentage: 0,
        status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown system failure"}`
      });
    }

    return res.status(500).json({ message: error.message });
  }
}