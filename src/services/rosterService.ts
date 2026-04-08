import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Team = Database["public"]["Tables"]["teams"]["Row"];
type Player = Database["public"]["Tables"]["players"]["Row"];

export const rosterService = {
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
    const { data, error } = await query.order("last_name");
    if (error) throw error;
    return data;
  },

  createTeam: async (team: Database["public"]["Tables"]["teams"]["Insert"]) => {
    const { data, error } = await supabase.from("teams").insert(team).select().single();
    if (error) throw error;
    return data;
  },

  createPlayer: async (player: Database["public"]["Tables"]["players"]["Insert"]) => {
    const { data, error } = await supabase.from("players").insert(player).select().single();
    if (error) throw error;
    return data;
  }
};