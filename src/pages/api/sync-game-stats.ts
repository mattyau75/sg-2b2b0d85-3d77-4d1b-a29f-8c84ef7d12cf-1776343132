import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * RE-ENGINEERED SYNC ENGINE (Module 3)
 * Implements a robust mapping and aggregation pipeline.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    console.log(`[Modular Sync] Starting deep sync for Game: ${gameId}`);

    // 1. IDENTITY PASS: Fetch Game and Team context
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_home_team_id_fkey(*)")
      .eq("id", gameId)
      .single();

    if (gameError || !game) throw new Error("Game context missing. Link teams first.");

    // 2. MAPPING PASS: Build the Jersey -> Player ID map from Directory
    const { data: roster } = await supabase
      .from("players")
      .select("id, number, team_id")
      .in("team_id", [game.home_team_id, game.away_team_id]);

    const playerMap: Record<string, string> = {};
    roster?.forEach(p => {
      if (p.number !== null) {
        playerMap[`${p.team_id}_${p.number}`] = p.id;
      }
    });

    // 3. EVENT RESOLUTION: Fetch and update raw PBP events
    const { data: events, error: eventsError } = await supabase
      .from("play_by_play")
      .select("*")
      .eq("game_id", gameId);

    if (eventsError) throw eventsError;

    console.log(`[Modular Sync] Resolving identities for ${events.length} events...`);
    
    let homeScore = 0;
    let awayScore = 0;
    const playerStats: Record<string, any> = {};

    for (const event of events) {
      let playerId = event.player_id;
      let teamId = event.team_id;

      // Logic: If we have a jersey number and a team type but no player_id, resolve it
      if (!playerId && event.jersey_number !== null) {
        // We assume the AI worker stamps team_id or we derive from game context
        const resolvedTeamId = teamId || (event.description?.toLowerCase().includes('home') ? game.home_team_id : game.away_team_id);
        if (resolvedTeamId) {
          playerId = playerMap[`${resolvedTeamId}_${event.jersey_number}`];
          teamId = resolvedTeamId;
        }
      }

      // Update the event record if identity was resolved
      if (playerId || teamId) {
        await supabase.from("play_by_play").update({ 
          player_id: playerId,
          team_id: teamId 
        }).eq("id", event.id);
      }

      // AGGREGATION: Calculate scores based on standardized event types
      const pts = event.is_make ? (event.event_type?.includes('3pt') ? 3 : 2) : 0;
      if (teamId === game.home_team_id) homeScore += pts;
      else if (teamId === game.away_team_id) awayScore += pts;

      // Track individual stats for Module 3
      if (playerId) {
        if (!playerStats[playerId]) {
          playerStats[playerId] = { 
            game_id: gameId, player_id: playerId, points: 0, rebounds: 0, assists: 0, 
            steals: 0, blocks: 0, turnovers: 0, fg_made: 0, fg_attempted: 0
          };
        }
        const s = playerStats[playerId];
        if (pts > 0) { 
          s.points += pts; 
          s.fg_made += 1; 
          s.fg_attempted += 1; 
        } else if (event.event_type?.includes('miss')) { 
          s.fg_attempted += 1; 
        }
        
        if (event.event_type?.toLowerCase().includes('rebound')) s.rebounds += 1;
        if (event.event_type?.toLowerCase().includes('assist')) s.assists += 1;
      }
    }

    // 4. PERSISTENCE: Update Game and Player Stats
    await supabase.from("games").update({ 
      home_score: homeScore, 
      away_score: awayScore,
      status: 'completed'
    }).eq("id", gameId);

    const statsArray = Object.values(playerStats);
    if (statsArray.length > 0) {
      await supabase.from('player_game_stats').upsert(statsArray, { onConflict: 'game_id,player_id' });
    }

    console.log(`[Modular Sync] Finished. Final Score: ${homeScore}-${awayScore}`);
    return res.status(200).json({ success: true, homeScore, awayScore });
  } catch (error: any) {
    console.error("[Modular Sync Error]", error.message);
    return res.status(500).json({ message: error.message });
  }
}