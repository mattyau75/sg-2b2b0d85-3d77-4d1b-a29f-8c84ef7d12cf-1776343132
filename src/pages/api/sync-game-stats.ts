import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("home_team_id, away_team_id")
      .eq("id", gameId)
      .single();

    if (gameError) throw gameError;

    const { data: events, error: eventsError } = await supabase
      .from("play_by_play")
      .select("*, player:players(team_id, name)")
      .eq("game_id", gameId)
      .order("timestamp_seconds", { ascending: true });

    if (eventsError) throw eventsError;

    const playerStats: Record<string, any> = {};
    const lineupStats: Record<string, any> = {};
    let homeScore = 0;
    let awayScore = 0;

    const currentHomeLineup: Set<string> = new Set();
    const currentAwayLineup: Set<string> = new Set();
    let lastTimestamp = 0;

    const getLineupKey = (ids: string[]) => [...ids].sort().join(",");

    events.forEach(event => {
      const isHome = event.player?.team_id === game.home_team_id;
      const pts = event.event_type === "made_2pt" ? 2 : event.event_type === "made_3pt" ? 3 : 0;
      const duration = event.timestamp_seconds - lastTimestamp;
      
      // Update tracking sets based on activity (Naive starter inference)
      if (event.player_id) {
        if (isHome) {
          if (currentHomeLineup.size < 5) currentHomeLineup.add(event.player_id);
        } else {
          if (currentAwayLineup.size < 5) currentAwayLineup.add(event.player_id);
        }
      }

      // Record interval stats for lineups
      if (duration > 0) {
        if (currentHomeLineup.size === 5) {
          const key = getLineupKey(Array.from(currentHomeLineup));
          if (!lineupStats[key]) lineupStats[key] = { game_id: gameId, team_id: game.home_team_id, player_ids: Array.from(currentHomeLineup), points_for: 0, points_against: 0, minutes_played: 0 };
          lineupStats[key].minutes_played += duration / 60;
        }
        if (currentAwayLineup.size === 5) {
          const key = getLineupKey(Array.from(currentAwayLineup));
          if (!lineupStats[key]) lineupStats[key] = { game_id: gameId, team_id: game.away_team_id, player_ids: Array.from(currentAwayLineup), points_for: 0, points_against: 0, minutes_played: 0 };
          lineupStats[key].minutes_played += duration / 60;
        }
      }

      // Distribute points
      if (isHome) {
        homeScore += pts;
        if (currentHomeLineup.size === 5) lineupStats[getLineupKey(Array.from(currentHomeLineup))].points_for += pts;
        if (currentAwayLineup.size === 5) lineupStats[getLineupKey(Array.from(currentAwayLineup))].points_against += pts;
      } else {
        awayScore += pts;
        if (currentAwayLineup.size === 5) lineupStats[getLineupKey(Array.from(currentAwayLineup))].points_for += pts;
        if (currentHomeLineup.size === 5) lineupStats[getLineupKey(Array.from(currentHomeLineup))].points_against += pts;
      }

      // Distribute individual stats
      if (event.player_id) {
        if (!playerStats[event.player_id]) {
          playerStats[event.player_id] = { 
            game_id: gameId, player_id: event.player_id, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
            fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0, plus_minus: 0
          };
        }
        const s = playerStats[event.player_id];
        if (event.event_type === "made_2pt") { s.points += 2; s.fg_made += 1; s.fg_attempted += 1; }
        if (event.event_type === "missed_2pt") { s.fg_attempted += 1; }
        if (event.event_type === "made_3pt") { s.points += 3; s.fg_made += 1; s.fg_attempted += 1; s.three_made += 1; s.three_attempted += 1; }
        if (event.event_type === "missed_3pt") { s.fg_attempted += 1; s.three_attempted += 1; }
        if (event.event_type === "rebound") s.rebounds += 1;
        if (event.event_type === "assist") s.assists += 1;
        if (event.event_type === "steal") s.steals += 1;
        if (event.event_type === "block") s.blocks += 1;
        if (event.event_type === "turnover") s.turnovers += 1;
      }

      lastTimestamp = event.timestamp_seconds;
    });

    // Write results
    const playerStatsArray = Object.values(playerStats);
    if (playerStatsArray.length > 0) {
      await supabase.from("player_game_stats").upsert(playerStatsArray, { onConflict: "game_id,player_id" });
    }

    const lineupsArray = Object.values(lineupStats).map((l: any) => ({
      ...l,
      minutes_played: Number(l.minutes_played.toFixed(2))
    }));
    if (lineupsArray.length > 0) {
      await supabase.from("lineup_stats").upsert(lineupsArray, { onConflict: "game_id,player_ids" });
    }

    await supabase.from("games").update({ home_score: homeScore, away_score: awayScore }).eq("id", gameId);

    return res.status(200).json({ success: true, homeScore, awayScore });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}