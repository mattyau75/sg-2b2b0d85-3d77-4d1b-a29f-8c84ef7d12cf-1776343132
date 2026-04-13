import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { triggerAnalysis } from "@/services/modalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 1. ATOMIC ID NORMALIZATION (LOWERCASE ONLY)
  const { gameId, video_path, videoUrl: bodyVideoUrl } = req.body;
  const rawId = gameId || req.body.game_id || req.body.metadata?.gameId;
  const finalGameId = rawId?.toString().toLowerCase();

  if (!finalGameId) {
    return res.status(400).json({ success: false, message: "Missing gameId for analysis ignition." });
  }

  try {
    // 2. PRIME HANDSHAKE (Standardized Log)
    await supabase.from("game_analysis").upsert({
      game_id: finalGameId,
      status: "initializing",
      progress_percentage: 5,
      status_message: "🤝 HANDSHAKE: Prime Ignition Sequence Established."
    }, { onConflict: 'game_id' });

    // 2. FETCH VIDEO SOURCE FROM DB IF MISSING
    let finalVideoUrl = bodyVideoUrl || video_path;
    
    if (!finalVideoUrl) {
      console.log(`[API] Fetching missing video source for game: ${finalGameId}`);
      const { data: game, error: fetchError } = await supabase
        .from("games")
        .select("video_path")
        .eq("id", finalGameId)
        .single();
      
      if (fetchError || !game?.video_path) {
        return res.status(404).json({ success: false, message: "Missing video source for AI analysis. Please ensure a video was uploaded in Module 1." });
      }
      finalVideoUrl = game.video_path;
    }

    // 3. DISPATCH TO MODAL
    console.log(`[API] Dispatching ignition to Modal for game ${finalGameId} with source: ${finalVideoUrl}`);

    // 🛡️ PRE-FLIGHT VALIDATION
    if (!finalVideoUrl) {
      throw new Error("Missing video source for AI analysis.");
    }

    // 🛡️ HANDSHAKE STABILIZER: Ensure frontend listener is ready
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 2. FORENSIC PAYLOAD LOG
    await supabase.from("game_analysis").upsert({
      game_id: finalGameId,
      status: "authorizing",
      progress_percentage: 10,
      status_message: `📦 PAYLOAD: Video Source [${finalVideoUrl?.substring(0, 30)}...] identified.`
    }, { onConflict: 'game_id' });

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
      metadata: req.body.metadata || {},
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