import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Secure server-side handler for resetting the platform data.
 * This TRUNCATES the main tables in the database.
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

    // We use a single SQL execution via a RPC or multiple delete calls if RPC isn't available.
    // Since we don't have a pre-defined RPC for truncate, we use the client to delete all rows.
    // Order matters for foreign keys.
    
    // 1. Delete dependent stats and logs
    await supabase.from("player_game_stats").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("play_by_play").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    // 2. Delete games
    await supabase.from("games").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    // 3. Delete players
    await supabase.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    // 4. Delete teams
    await supabase.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return res.status(200).json({ 
      success: true, 
      message: "Platform reset successfully. All data purged." 
    });

  } catch (error: any) {
    console.error("Platform reset error:", error);
    return res.status(500).json({ message: error.message || "Failed to reset platform" });
  }
}