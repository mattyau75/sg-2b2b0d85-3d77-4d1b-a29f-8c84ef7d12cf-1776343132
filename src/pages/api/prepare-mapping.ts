import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    // 🛡️ SECURITY HANDSHAKE: Align with specific auth-helpers v0.15 3-argument signature
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { req, res }
    );
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    const { gameId, homeTeamId, awayTeamId } = req.body;

    if (!gameId || !homeTeamId || !awayTeamId) {
      return res.status(400).json({ message: "Missing required IDs" });
    }

    // 1. Fetch current rosters
    const { data: homePlayers, error: homeError } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('team_id', homeTeamId);
      
    const { data: awayPlayers, error: awayError } = await supabase
      .from('players')
      .select('id, team_id')
      .eq('team_id', awayTeamId);

    if (homeError || awayError) throw new Error("Failed to fetch directory rosters");

    const fullRoster = [...(homePlayers || []), ...(awayPlayers || [])];

    // 2. Fetch players already in the game's stats table
    const { data: existingStats, error: existingError } = await supabase
      .from('player_game_stats')
      .select('player_id')
      .eq('game_id', gameId);

    if (existingError) throw new Error("Failed to check existing game stats");

    const existingPlayerIds = new Set(existingStats?.map(s => s.player_id) || []);
    const newPlayers = fullRoster.filter(p => !existingPlayerIds.has(p.id));

    if (newPlayers.length === 0) {
      return res.status(200).json({ success: true, count: 0 });
    }

    // 4. Prepare entries
    const statsEntries = newPlayers.map(p => ({
      game_id: gameId,
      player_id: p.id,
      team_id: p.team_id,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      fg_made: 0,
      fg_attempted: 0,
      minutes: 0
    }));

    const { error: insertError } = await supabase
      .from('player_game_stats')
      .upsert(statsEntries as any, { onConflict: 'game_id,player_id' });

    if (insertError) {
      logger.error("[PrepareMapping] Insert Error", insertError);
      throw insertError;
    }

    return res.status(200).json({ success: true, count: statsEntries.length });

  } catch (error: any) {
    logger.error("[PrepareMapping] Crash", error);
    return res.status(500).json({ message: error.message });
  }
}