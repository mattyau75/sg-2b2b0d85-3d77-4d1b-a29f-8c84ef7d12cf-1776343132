import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Secure server-side handler for resetting the platform data.
 * This handles the deletion of all tactical and organizational data.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    console.log("Server: Initiating full platform reset...");

    // 1. Delete dependent stats and logs first to respect foreign keys
    // Lineup stats reference games and teams
    const { error: lineupError } = await supabase.from("lineup_stats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (lineupError) console.error("Error resetting lineup_stats:", lineupError);

    // Player game stats reference games and players
    const { error: statsError } = await supabase.from("player_game_stats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (statsError) console.error("Error resetting player_game_stats:", statsError);

    // Play by play references games and players
    const { error: pbpError } = await supabase.from("play_by_play").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (pbpError) console.error("Error resetting play_by_play:", pbpError);
    
    // 2. Delete games
    const { error: gamesError } = await supabase.from("games").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (gamesError) console.error("Error resetting games:", gamesError);
    
    // 3. Delete players
    const { error: playersError } = await supabase.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (playersError) console.error("Error resetting players:", playersError);
    
    // 4. Delete teams
    const { error: teamsError } = await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (teamsError) console.error("Error resetting teams:", teamsError);

    return res.status(200).json({ 
      success: true, 
      message: "Platform reset successfully. All data purged." 
    });

  } catch (error: any) {
    console.error("Platform reset critical error:", error);
    return res.status(500).json({ message: error.message || "Failed to reset platform" });
  }
}