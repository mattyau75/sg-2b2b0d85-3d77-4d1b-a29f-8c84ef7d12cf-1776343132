import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { triggerAnalysis } from "@/services/modalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 🛡️ ATOMIC ID EXTRACTION: Supporting all naming conventions
  const { gameId, game_id, metadata } = req.body;
  const finalGameId = gameId || game_id || metadata?.gameId || metadata?.game_id || metadata?.id;

  if (!finalGameId) {
    return res.status(400).json({ 
      message: "❌ CRITICAL SYSTEM STALL: Missing required Game ID for ignition." 
    });
  }

  try {
    // 🤝 PRIME HANDSHAKE: Establish DB link as the absolute first command
    const { error: handshakeError } = await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 1,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Started..."
    });

    if (handshakeError) throw handshakeError;

    // 2. AUTHORIZATION & METADATA PREP
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 5,
      status_message: "🔐 AUTH: Authorizing GPU cluster and verifying video payload..."
    });

    if (!videoUrl) throw new Error("Missing required video URL for AI processing.");

    // 3. TRIGGER GPU IGNITION
    await triggerAnalysis({
      gameId: finalGameId,
      videoUrl,
      metadata: metadata || { id: finalGameId },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    });

    return res.status(200).json({ message: "Ignition signal dispatched successfully." });

  } catch (error: any) {
    console.error("❌ IGNITION FAILURE:", error);
    
    // FORENSIC ERROR LOGGING: Push directly to trace
    await supabase.from("game_analysis").insert({
      game_id: finalGameId,
      status: "error",
      progress_percentage: 0,
      status_message: `🚨 HANDSHAKE ERROR: ${error.message || "Unknown ignition failure"}`
    });

    return res.status(500).json({ message: error.message });
  }
}