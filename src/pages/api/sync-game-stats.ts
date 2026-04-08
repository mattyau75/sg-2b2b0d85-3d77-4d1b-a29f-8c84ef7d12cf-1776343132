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
      .select("*, player:players(team_id, name)")
      .eq("game_id", gameId)
      .order("timestamp_seconds", { ascending: true });

    if (eventsError) throw eventsError;

    const playerStats: Record<string, any> = {};
    const lineupStats: Record<string, any> = {};
    let homeScore = 0;
    let awayScore = 0;

    // Lineup Tracking (Naive implementation: assume first 5 players seen per team are starters if not explicitly subbed)
    // Real logic would require "substitution" event types
    const currentHomeLineup: string[] = [];
    const currentAwayLineup: string[] = [];
    let lastTimestamp = 0;

    const getLineupKey = (ids: string[]) => [...ids].sort().join(",");

    events.forEach(event => {
      const isHome = event.player?.team_id === game.home_team_id;
      const pts = event.event_type === "made_2pt" ? 2 : event.event_type === "made_3pt" ? 3 : 0;
      
      const duration = event.timestamp_seconds - lastTimestamp;
      
      // Update Lineup Stats for the interval since last event
      if (duration > 0 && currentHomeLineup.length === 5) {
        const homeKey = getLineupKey(currentHomeLineup);
        if (!lineupStats[homeKey]) {
          lineupStats[homeKey] = { 
            game_id: gameId, team_id: game.home_team_id, player_ids: currentHomeLineup,
            points_for: 0, points_against: 0, minutes_played: 0, possessions: 0 
          };
        }
        lineupStats[homeKey].minutes_played += Math.round(duration / 60);
      }

      if (duration > 0 && currentAwayLineup.length === 5) {
        const awayKey = getLineupKey(currentAwayLineup);
        if (!lineupStats[awayKey]) {
          lineupStats[awayKey] = { 
            game_id: gameId, team_id: game.away_team_id, player_ids: currentAwayLineup,
            points_for: 0, points_against: 0, minutes_played: 0, possessions: 0 
          };
        }
        lineupStats[awayKey].minutes_played += Math.round(duration / 60);
      }

      // Track Scores
      if (isHome) {
        homeScore += pts;
        if (currentHomeLineup.length === 5) lineupStats[getLineupKey(currentHomeLineup)].points_for += pts;
        if (currentAwayLineup.length === 5) lineupStats[getLineupKey(currentAwayLineup)].points_against += pts;
      } else {
        awayScore += pts;
        if (currentAwayLineup.length === 5) lineupStats[getLineupKey(currentAwayLineup)].points_for += pts;
        if (currentHomeLineup.length === 5) lineupStats[getLineupKey(currentHomeLineup)].points_against += pts;
      }

      // Handle Substitutions (Assuming event_type "sub_in" and "sub_out" exist or are inferred)
      if (event.player_id) {
        if (isHome && !currentHomeLineup.includes(event.player_id) && currentHomeLineup.length < 5) {
          currentHomeLineup.push(event.player_id);
        } else if (!isHome && !currentAwayLineup.includes(event.player_id) && currentAwayLineup.length < 5) {
          currentAwayLineup.push(event.player_id);
        }

        // Standard Player Stats
        if (!playerStats[event.player_id]) {
          playerStats[event.player_id] = { 
            game_id: gameId, player_id: event.player_id, 
            points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
            fg_made: 0, fg_attempted: 0, three_made: 0, three_attempted: 0,
            plus_minus: 0
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
      }

      lastTimestamp = event.timestamp_seconds;
    });

    // Update Player Plus/Minus
    // This is a simplified version; real +/- tracks every player on court during every point
    // We'll calculate it based on the homeScore/awayScore difference if they were on court
    // For this build, we'll keep the basic stats and focus on Lineup entries.

    const statsArray = Object.values(playerStats);
    if (statsArray.length > 0) {
      await supabase.from("player_game_stats").upsert(statsArray, { onConflict: "game_id,player_id" });
    }

    const lineupsArray = Object.values(lineupStats);
    if (lineupsArray.length > 0) {
      await supabase.from("lineup_stats").upsert(lineupsArray, { onConflict: "game_id,player_ids" });
    }

    await supabase.from("games").update({ home_score: homeScore, away_score: awayScore } as any).eq("id", gameId);

    return res.status(200).json({ success: true, homeScore, awayScore, lineupsFound: lineupsArray.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}