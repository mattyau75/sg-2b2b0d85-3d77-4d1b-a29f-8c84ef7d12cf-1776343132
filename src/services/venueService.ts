import { supabase } from "@/integrations/supabase/client";

export const venueService = {
  async getVenues() {
    const { data, error } = await supabase
      .from("venues")
      .select("*")
      .order("name");
    
    if (error) throw error;
    return data || [];
  },

  async createVenue(name: string) {
    const { data, error } = await supabase
      .from("venues")
      .insert([{ name }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};