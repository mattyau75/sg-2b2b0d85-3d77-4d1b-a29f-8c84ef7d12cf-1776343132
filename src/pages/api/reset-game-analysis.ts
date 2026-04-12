import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Game ID is required" });

  try {
    console.log(`[ResetAnalysis] Forcing reset for game: ${gameId}`);

    // 1. Reset Game Status and Clear Metadata
    const { error: gameError } = await supabase
      .from("games")
      .update({
        status: "pending",
        processing_metadata: {},
        is_m2_complete: false,
        analysis_progress: 0
      })
      .eq("id", gameId);

    if (gameError) throw gameError;

    // 2. Clear Worker Logs for this game
    const { error: logsError } = await supabase
      .from("worker_logs")
      .delete()
      .eq("game_id", gameId);

    // Some systems might not have worker_logs yet, ignore error
    console.log(`[ResetAnalysis] ✅ System cleared for ${gameId}`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[ResetAnalysis] Fatal error during reset:", error);
    return res.status(500).json({ error: error.message });
  }
}