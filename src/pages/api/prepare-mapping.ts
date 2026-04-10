import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { gameId, homeTeamId, awayTeamId } = req.body;

    if (!gameId || !homeTeamId || !awayTeamId) {
      return res.status(400).json({ message: "Missing required IDs" });
    }

    // 1. Fetch all players for both teams
    const { data: homePlayers, error: homeError } = await supabase.from('players').select('id, team_id').eq('team_id', homeTeamId);
    const { data: awayPlayers, error: awayError } = await supabase.from('players').select('id, team_id').eq('team_id', awayTeamId);

    if (homeError || awayError) throw new Error("Failed to fetch rosters");

    const allPlayers = [...(homePlayers || []), ...(awayPlayers || [])];

    if (allPlayers.length === 0) {
      return res.status(200).json({ success: true, message: "No players found to pre-populate", count: 0 });
    }

    // 2. Pre-populate player_game_stats placeholders for mapping
    const statsEntries = allPlayers.map(p => ({
      game_id: gameId,
      player_id: p.id,
      team_id: p.team_id,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      fg_made: 0,
      fg_attempted: 0
    }));

    // Upsert based on the (game_id, player_id) unique constraint
    const { error: statsError } = await supabase
      .from('player_game_stats')
      .upsert(statsEntries, { onConflict: 'game_id,player_id' });

    if (statsError) {
      console.error("[PrepareMapping] Upsert Error:", statsError);
      throw statsError;
    }

    return res.status(200).json({ 
      success: true, 
      message: "Rosters pre-populated for Mapping Module",
      count: statsEntries.length 
    });

  } catch (error: any) {
    console.error("[PrepareMapping] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}