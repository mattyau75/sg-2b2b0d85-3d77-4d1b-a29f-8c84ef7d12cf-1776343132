import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    // 1. Get Game and Team context
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("home_team_id, away_team_id")
      .eq("id", gameId)
      .single();

    if (gameError) throw gameError;
    if (!game.home_team_id || !game.away_team_id) {
      throw new Error("Game is missing team assignments. Link teams before syncing stats.");
    }

    // NEW: Auto-repair events that might be missing team_id or player_id
    // This is crucial for games that were uploaded before the teams were correctly linked
    console.log(`[Sync] Running auto-repair for Game: ${gameId}`);
    
    // Update events that have no team_id (we'll assume team_id based on jersey color or sequence if needed, 
    // but for now let's just ensure we have the player mapping)
    
    // 2. Fetch Roster for mapping (Jersey Number -> Player ID)
    const { data: roster, error: rosterError } = await supabase
      .from("players")
      .select("id, number, team_id")
      .in("team_id", [game.home_team_id, game.away_team_id]);

    if (rosterError) throw rosterError;

    // Create a mapping: team_id + jersey_number -> player_id
    const playerMap: Record<string, string> = {};
    roster.forEach(p => {
      if (p.number !== null) {
        playerMap[`${p.team_id}_${p.number}`] = p.id;
      }
    });

    // 3. Get all play-by-play events
    const { data: events, error: eventsError } = await supabase
      .from("play_by_play")
      .select("*")
      .eq("game_id", gameId)
      .order("timestamp_seconds", { ascending: true });

    if (eventsError) throw eventsError;

    // 4. Resolve missing player_ids via jersey numbers if needed
    const updates = events
      .filter((e: any) => !e.player_id && e.jersey_number !== null)
      .map((e: any) => {
        // If event is missing team_id, we try to infer it from the game context
        // This handles older events created before the team links were restored
        const effectiveTeamId = e.team_id || (e.team_type === 'home' ? game.home_team_id : game.away_team_id);
        if (!effectiveTeamId) return null;

        const playerId = playerMap[`${effectiveTeamId}_${e.jersey_number}`];
        if (playerId) return { id: e.id, player_id: playerId, team_id: effectiveTeamId };
        return null;
      })
      .filter(Boolean);

    if (updates.length > 0) {
      console.log(`[Sync] Resolving ${updates.length} players via jersey numbers...`);
      for (const update of updates) {
        await supabase.from("play_by_play").update({ 
          player_id: update!.player_id,
          team_id: update!.team_id 
        }).eq("id", update!.id);
      }
    }

    // 5. Re-fetch events with linked player data
    const { data: linkedEvents, error: linkedError } = await supabase
      .from("play_by_play")
      .select("*, player:players(team_id, name)")
      .eq("game_id", gameId);

    if (linkedError) throw linkedError;

    const playerStats: Record<string, any> = {};
    const lineupStats: Record<string, any> = {};
    let homeScore = 0;
    let awayScore = 0;

    const currentHomeLineup: Set<string> = new Set();
    const currentAwayLineup: Set<string> = new Set();
    let lastTimestamp = 0;

    const getLineupKey = (ids: string[]) => [...ids].sort().join(",");

    linkedEvents.forEach(event => {
      const isHome = event.player?.team_id === game.home_team_id;
      const pts = event.event_type === "made_2pt" ? 2 : event.event_type === "made_3pt" ? 3 : 0;
      const duration = event.timestamp_seconds - lastTimestamp;
      
      // Basic lineup tracking logic
      if (event.player_id) {
        if (isHome) {
          if (currentHomeLineup.size < 5) currentHomeLineup.add(event.player_id);
        } else {
          if (currentAwayLineup.size < 5) currentAwayLineup.add(event.player_id);
        }
      }

      // Record interval stats
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
        const key = getLineupKey(Array.from(currentHomeLineup));
        if (currentHomeLineup.size === 5 && lineupStats[key]) lineupStats[key].points_for += pts;
        const oppKey = getLineupKey(Array.from(currentAwayLineup));
        if (currentAwayLineup.size === 5 && lineupStats[oppKey]) lineupStats[oppKey].points_against += pts;
      } else {
        awayScore += pts;
        const key = getLineupKey(Array.from(currentAwayLineup));
        if (currentAwayLineup.size === 5 && lineupStats[key]) lineupStats[key].points_for += pts;
        const oppKey = getLineupKey(Array.from(currentHomeLineup));
        if (currentHomeLineup.size === 5 && lineupStats[oppKey]) lineupStats[oppKey].points_against += pts;
      }

      // Individual stats
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
      const { error: statsError } = await supabase
        .from('player_game_stats')
        .upsert(playerStatsArray, { onConflict: 'game_id,player_id' });
        
      if (statsError) throw statsError;
    }

    const lineupsArray = Object.values(lineupStats).map((l: any) => ({
      ...l,
      minutes_played: Number(l.minutes_played.toFixed(2))
    }));
    if (lineupsArray.length > 0) {
      await supabase.from("lineup_stats").upsert(lineupsArray, { onConflict: "game_id,player_ids" });
    }

    await supabase.from("games").update({ 
      home_score: homeScore, 
      away_score: awayScore,
      status: 'completed'
    }).eq("id", gameId);

    return res.status(200).json({ success: true, homeScore, awayScore, eventsCount: linkedEvents.length });
  } catch (error: any) {
    console.error("[Sync Error]", error.message);
    return res.status(500).json({ message: error.message });
  }
}