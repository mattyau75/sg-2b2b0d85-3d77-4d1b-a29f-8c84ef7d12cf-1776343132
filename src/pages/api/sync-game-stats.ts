import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";
import { calculateBoxScore } from "@/lib/stat-utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ message: "Game ID required" });

  try {
    // 🛡️ SECURITY HANDSHAKE: Standardized 1-arg signature for Pages Router
    const supabase = createServerClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return res.status(401).json({ error: "Unauthorized access blocked." });

    logger.info(`[Sync] Tactical sync initiated for ${gameId}`);

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)")
      .eq("id", gameId)
      .single();

    if (gameError || !game) return res.status(404).json({ error: "Game not found" });

    const { data: events } = await supabase.from('play_by_play').select('*').eq('game_id', gameId);
    const { data: roster } = await supabase.from('players').select('*').in('team_id', [game.home_team_id, game.away_team_id]);

    const calculatedStats = calculateBoxScore(events || [], roster || []);
    
    if (calculatedStats.length > 0) {
      const statsToUpsert = calculatedStats.map(s => ({
        game_id: gameId,
        player_id: s.id,
        points: s.points,
        rebounds: s.rebounds,
        assists: s.assists,
        fg_made: s.fg_made,
        fg_attempted: s.fg_attempted
      }));
      await supabase.from('player_game_stats').upsert(statsToUpsert, { onConflict: 'game_id,player_id' });
    }

    await supabase.from("games").update({ status: 'completed' } as any).eq("id", gameId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    logger.error("[Sync] Fatal error", error);
    return res.status(500).json({ message: error.message });
  }
}