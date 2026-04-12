import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Game ID is required" });

  try {
    console.log(`[ResetAnalysis] Forcing reset for game: ${gameId}`);

    // Atomic reset of all analysis-related fields
    const { error } = await supabase
      .from('games')
      .update({
        status: 'scheduled',
        progress_percentage: 0,
        last_error: null,
        ignition_status: 'pending',
        m2_complete: false,
        processing_metadata: {
          worker_logs: [],
          last_heartbeat: null
        }
      } as any)
      .eq('id', gameId);

    if (error) throw error;

    console.log(`[ResetAnalysis] ✅ System state cleared for ${gameId}`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[ResetAnalysis] Fatal error during reset:", error);
    return res.status(500).json({ error: error.message });
  }
}