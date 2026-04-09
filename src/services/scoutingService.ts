import { supabase } from "@/integrations/supabase/client";

/**
 * The Identity & Mapping Engine
 * This service ensures that AI-detected jersey numbers are correctly mapped 
 * to real players in your directory.
 */
export const scoutingService = {
  /**
   * Resolves a jersey number to a specific player ID based on team and game context.
   */
  async resolvePlayer(gameId: string, teamType: 'home' | 'away', jerseyNumber: number) {
    // 1. Get the actual team ID for this game
    const { data: game } = await supabase
      .from('games')
      .select('home_team_id, away_team_id')
      .eq('id', gameId)
      .single();

    if (!game) return null;

    const teamId = teamType === 'home' ? game.home_team_id : game.away_team_id;
    if (!teamId) return null;

    // 2. Lookup player by team and number
    const { data: player } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('number', jerseyNumber)
      .maybeSingle();

    return player;
  },

  /**
   * Re-maps an entire game's play-by-play events to the directory.
   * This is the "Modular Bridge" that fixes the disconnected feel.
   */
  async remapGameEvents(gameId: string) {
    const { data: events } = await supabase
      .from('play_by_play')
      .select('*')
      .eq('game_id', gameId);

    if (!events) return;

    for (const event of events) {
      if (event.jersey_number && event.team_type) {
        const player = await this.resolvePlayer(gameId, event.team_type as 'home' | 'away', event.jersey_number);
        if (player) {
          await supabase
            .from('play_by_play')
            .update({ 
              player_id: player.id,
              // Also ensure team_id is correctly stamped for easier aggregation
              team_id: (await this.getGameTeamId(gameId, event.team_type as 'home' | 'away'))
            })
            .eq('id', event.id);
        }
      }
    }
  },

  async getGameTeamId(gameId: string, teamType: 'home' | 'away') {
    const { data: game } = await supabase
      .from('games')
      .select('home_team_id, away_team_id')
      .eq('id', gameId)
      .single();
    return teamType === 'home' ? game?.home_team_id : game?.away_team_id;
  }
};