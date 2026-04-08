import { supabase } from "@/integrations/supabase/client";

export const rosterService = {
  /**
   * Fetches all teams with their player counts
   */
  getTeams: async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name");
    if (error) throw error;
    return data;
  },

  getTeam: async (id: string) => {
    const { data, error } = await supabase
      .from("teams")
      .select(`
        *,
        players (*)
      `)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  getPlayers: async (teamId?: string) => {
    let query = supabase.from("players").select("*, teams(name)");
    if (teamId) {
      query = query.eq("team_id", teamId);
    }
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data;
  },

  createTeam: async (team: { name: string; city?: string; logo_url?: string; primary_color?: string }) => {
    const { data, error } = await supabase.from("teams").insert(team).select().single();
    if (error) throw error;
    return data;
  },

  updateTeam: async (id: string, updates: { name?: string; city?: string; logo_url?: string; primary_color?: string }) => {
    const { data, error } = await supabase.from("teams").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  createPlayer: async (player: { team_id: string; name: string; number?: number; position?: string; avatar_url?: string }) => {
    const { data, error } = await supabase.from("players").insert(player).select().single();
    if (error) throw error;
    return data;
  },

  updatePlayer: async (id: string, updates: { name?: string; number?: number; position?: string; avatar_url?: string }) => {
    const { data, error } = await supabase.from("players").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
};