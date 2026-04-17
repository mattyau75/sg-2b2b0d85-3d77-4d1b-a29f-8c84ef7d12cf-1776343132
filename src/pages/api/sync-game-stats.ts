import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Watchdog API: Can be called by a cron job or manual trigger to clean up "Zombie" jobs
  const { data: stalledGames } = await supabase
    .from("games")
    .select("id, updated_at")
    .eq("status", "analyzing")
    .lt("updated_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  if (stalledGames && stalledGames.length > 0) {
    for (const game of stalledGames) {
      await supabase.from("games").update({ 
        status: "error", 
        status_message: "Stall Detected: No activity for 15 minutes." 
      }).eq("id", game.id);
      
      await supabase.from("game_events").insert({
        game_id: game.id,
        event_type: "watchdog_timeout",
        severity: "error",
        payload: { message: "System watchdog terminated job due to inactivity." },
        timestamp_ms: Date.now()
      });
    }
  }

  return res.status(200).json({ checked: stalledGames?.length || 0 });
}