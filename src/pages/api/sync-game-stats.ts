import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    // 1. Fetch game info to get home/away team IDs
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("home_team_id, away_team_id")
      .eq("id", gameId)
      .single();

    if (gameError) throw gameError;

    // 2. Fetch all events and their associated player/team info
    const { data: events, error: eventsError } = await supabase
      .from("play_by_play")
      .select("*, player:players(team_id)")
      .eq("game_id", gameId);

    if (eventsError) throw eventsError;

    const playerStats: Record<string, any> = {};
    let homeScore = 0;
    let awayScore = 0;

    events.forEach(event => {
      const isHome = event.player?.team_id === game.home_team_id;
      const pts = event.event_type === "made_2pt" ? 2 : event.event_type === "made_3pt" ? 3 : 0;
      
      if (isHome) homeScore += pts;
      else awayScore += pts;

      if (!event.player_id) return;
      if (!playerStats[event.player_id]) {
        playerStats[event.player_id] = { 
          game_id: gameId, player_id: event.player_id, 
          points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
          fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0 
        };
      }
      
      const stats = playerStats[event.player_id];
      if (event.event_type === "made_2pt") { stats.points += 2; stats.fg_made += 1; stats.fg_attempted += 1; }
      if (event.event_type === "missed_2pt") { stats.fg_attempted += 1; }
      if (event.event_type === "made_3pt") { stats.points += 3; stats.fg_made += 1; stats.fg_attempted += 1; stats.three_made += 1; stats.three_attempted += 1; }
      if (event.event_type === "missed_3pt") { stats.fg_attempted += 1; stats.three_attempted += 1; }
      if (event.event_type === "rebound") stats.rebounds += 1;
      if (event.event_type === "assist") stats.assists += 1;
      if (event.event_type === "steal") stats.steals += 1;
      if (event.event_type === "block") stats.blocks += 1;
      if (event.event_type === "turnover") stats.turnovers += 1;
    });

    const statsArray = Object.values(playerStats);
    if (statsArray.length > 0) {
      const { error: upsertError } = await supabase
        .from("player_game_stats")
        .upsert(statsArray, { onConflict: "game_id,player_id" });
      if (upsertError) throw upsertError;
    }

    const { error: gameUpdateError } = await supabase
      .from("games")
      .update({ home_score: homeScore, away_score: awayScore } as any)
      .eq("id", gameId);

    if (gameUpdateError) throw gameUpdateError;

    return res.status(200).json({ success: true, homeScore, awayScore });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}