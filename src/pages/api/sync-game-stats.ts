import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    console.log(`[Sync] Starting deep sync for Game: ${gameId}`);

    // 1. Get Game and Team context
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
      .eq("id", gameId)
      .single();

    if (gameError || !game) throw new Error("Game not found or teams not linked.");

    // 2. Fetch Rosters for mapping (Jersey Number -> Player ID)
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
      .eq("game_id", gameId);

    if (eventsError) throw eventsError;

    // 4. Resolve missing player_ids via jersey numbers and correct team_id
    console.log(`[Sync] Mapping ${events.length} events to rosters...`);
    
    let homeScore = 0;
    let awayScore = 0;
    const playerStats: Record<string, any> = {};

    for (const event of events) {
      // Determine the team for this event if not explicit
      // AI usually tags 'home' or 'away' in metadata/team_type
      const teamId = event.team_id || (event.team_type === 'home' ? game.home_team_id : game.away_team_id);
      
      let playerId = event.player_id;
      if (!playerId && event.jersey_number !== null && teamId) {
        playerId = playerMap[`${teamId}_${event.jersey_number}`];
      }

      // Update the PBP record with the resolved player/team
      if (playerId || teamId) {
        await supabase.from("play_by_play").update({ 
          player_id: playerId,
          team_id: teamId 
        }).eq("id", event.id);
      }

      // Aggregate Score
      const pts = event.event_type === "made_2pt" ? 2 : event.event_type === "made_3pt" ? 3 : 0;
      if (teamId === game.home_team_id) homeScore += pts;
      else if (teamId === game.away_team_id) awayScore += pts;

      // Track individual stats if player resolved
      if (playerId) {
        if (!playerStats[playerId]) {
          playerStats[playerId] = { 
            game_id: gameId, player_id: playerId, points: 0, rebounds: 0, assists: 0, 
            steals: 0, blocks: 0, turnovers: 0, fg_made: 0, fg_attempted: 0
          };
        }
        const s = playerStats[playerId];
        if (pts > 0) { s.points += pts; s.fg_made += 1; s.fg_attempted += 1; }
        else if (event.event_type?.includes("missed")) { s.fg_attempted += 1; }
        if (event.event_type === "rebound") s.rebounds += 1;
        if (event.event_type === "assist") s.assists += 1;
      }
    }

    // 5. Update Game Totals and Individual Stats
    await supabase.from("games").update({ 
      home_score: homeScore, 
      away_score: awayScore,
      status: 'completed'
    }).eq("id", gameId);

    const statsArray = Object.values(playerStats);
    if (statsArray.length > 0) {
      await supabase.from('player_game_stats').upsert(statsArray, { onConflict: 'game_id,player_id' });
    }

    console.log(`[Sync] Finished. Final Score: ${homeScore}-${awayScore}`);
    return res.status(200).json({ success: true, homeScore, awayScore, eventsCount: events.length });
  } catch (error: any) {
    console.error("[Sync Error]", error.message);
    return res.status(500).json({ message: error.message });
  }
}