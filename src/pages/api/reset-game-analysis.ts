import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Game ID is required" });

  try {
    console.log(`[ResetAnalysis] Forcing reset for game: ${gameId}`);

    // 1. Reset Game Status and Clear Metadata in ONE transaction
    // We clear worker_logs and progress markers inside the processing_metadata JSONB field
    const { error: gameError } = await supabase
      .from("games")
      .update({
        status: "pending",
        progress_percentage: 0,
        ignition_status: "pending",
        last_error: null,
        processing_metadata: {
          worker_logs: [],
          last_heartbeat: null,
          ignition_time: null
        } as any,
        m2_complete: false,
        updated_at: new Date().toISOString()
      } as any)
      .eq("id", gameId);

    if (gameError) throw gameError;

    console.log(`[ResetAnalysis] ✅ System state cleared for ${gameId}`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[ResetAnalysis] Fatal error during reset:", error);
    return res.status(500).json({ error: error.message });
  }
}