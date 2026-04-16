import { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Game ID is required" });

  try {
    // 🛡️ SECURITY HANDSHAKE (Corrected Signature)
    const supabase = createServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    logger.info(`[ResetAnalysis] Forcing reset`, { gameId });

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

    logger.info(`[ResetAnalysis] System state cleared`, { gameId });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("[ResetAnalysis] Fatal error during reset", error);
    return res.status(500).json({ error: error.message });
  }
}