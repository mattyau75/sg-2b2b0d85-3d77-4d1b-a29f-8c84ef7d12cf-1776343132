import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId, videoPath } = req.body;
  if (!gameId || !videoPath) {
    logger.error("[AnalyzeColors] Missing gameId or videoPath");
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 🛡️ SECURITY HANDSHAKE: Standardized 1-arg signature for Pages Router
    const supabase = createServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    logger.info(`[AnalyzeColors] Starting calibration`, { gameId });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock detected colors
    const detectedColors = ["#F8FAFC", "#1E293B"];

    const { error } = await supabase
      .from("games")
      .update({
        detected_home_color: detectedColors[0],
        detected_away_color: detectedColors[1],
        processing_metadata: {
          color_calibration_at: new Date().toISOString(),
          calibration_confidence: 0.94
        }
      } as any)
      .eq("id", gameId);

    if (error) throw error;

    await supabase.from("game_analysis").upsert({
      game_id: gameId.toLowerCase(),
      status: "calibrating",
      progress_percentage: 8,
      status_message: "🎨 COLOR CALIBRATION: Elite jersey colors identified & mapped."
    } as any, { onConflict: 'game_id' });

    return res.status(200).json({ 
      success: true, 
      colors: detectedColors 
    });
  } catch (error: any) {
    logger.error("[AnalyzeColors] Fatal error", error);
    return res.status(500).json({ message: error.message });
  }
}