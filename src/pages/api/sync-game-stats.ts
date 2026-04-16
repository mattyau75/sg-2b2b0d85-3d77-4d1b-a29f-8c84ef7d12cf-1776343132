import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";
import { calculateBoxScore } from "@/lib/stat-utils";

/**
 * RE-ENGINEERED SYNC ENGINE (Module 3)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    // 🛡️ SECURITY HANDSHAKE
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { req, res }
    );
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    logger.info(`[Modular Sync] Starting identity-first sync`, { gameId });

    // 1. IDENTITY PASS: Fetch Game and Roster context
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: "Game not found" });
    }

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

    // Get manual mappings if any - cast JSON metadata for type safety
    const metadata = game.processing_metadata as any;
    const manualMappings = metadata?.manual_mappings || {};

    // 2. Fetch play-by-play events
    const { data: events, error: eventsError } = await supabase
      .from('play_by_play')
      .select('*')
      .eq('game_id', gameId);

    if (eventsError) throw eventsError;

    // 3. Update play-by-play player_ids based on jersey numbers and manual mappings
    const { data: players } = await supabase.from('players').select('*');
    const playersMap = players?.reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {}) || {};

    const initialEvents = events || [];
    const eventsToUpdate = initialEvents.map(event => {
      const mappingKey = `${event.team_id}-${event.jersey_number}`;
      const manualPlayerId = manualMappings[mappingKey];
      
      let finalPlayerId = event.player_id;

      if (manualPlayerId) {
        finalPlayerId = manualPlayerId;
      } else if (event.jersey_number && event.team_id) {
        const autoMatch = players?.find(p => p.team_id === event.team_id && p.number === event.jersey_number);
        if (autoMatch) finalPlayerId = autoMatch.id;
      }

      return { ...event, player_id: finalPlayerId };
    });

    // Bulk update PBP (for mapping integrity)
    for (const event of eventsToUpdate) {
      if (event.player_id !== initialEvents.find(e => e.id === event.id)?.player_id) {
        await supabase.from('play_by_play').update({ player_id: event.player_id }).eq('id', event.id);
      }
    }

    let homeScore = 0;
    let awayScore = 0;

    for (const event of eventsToUpdate) {
      const teamId = event.team_id;

      if (event.is_make) {
        const pts = event.event_type?.toUpperCase().includes('3PT') ? 3 : (event.event_type?.toUpperCase().includes('FT') ? 1 : 2);
        if (teamId === game.home_team_id) homeScore += pts;
        else if (teamId === game.away_team_id) awayScore += pts;
      }
    }

    // 4. BOX SCORE PERSISTENCE
    const { data: finalEvents } = await supabase.from("play_by_play").select("*").eq("game_id", gameId);
    const { data: fullRoster } = await supabase.from("players").select("*").in("team_id", [game.home_team_id, game.away_team_id]);
    
    const calculatedStats = calculateBoxScore(finalEvents || [], fullRoster || []);
    
    if (calculatedStats.length > 0) {
      const statsToUpsert = calculatedStats.map(s => ({
        game_id: gameId,
        player_id: s.id,
        points: s.points,
        rebounds: s.rebounds,
        assists: s.assists,
        steals: s.steals,
        blocks: s.blocks,
        turnovers: s.turnovers,
        fg_made: s.fg_made,
        fg_attempted: s.fg_attempted,
        three_made: s.three_made,
        three_attempted: s.three_attempted,
        ft_made: s.ft_made,
        ft_attempted: s.ft_attempted
      }));
      await supabase.from('player_game_stats').upsert(statsToUpsert, { onConflict: 'game_id,player_id' });
    }

    await supabase.from("games").update({ 
      home_score: homeScore, 
      away_score: awayScore,
      status: 'completed'
    }).eq("id", gameId);

    return res.status(200).json({ success: true, homeScore, awayScore });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}