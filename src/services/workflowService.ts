import { supabase } from "@/integrations/supabase/client";

export type ModuleStatus = "pending" | "in_progress" | "completed" | "error";

export const workflowService = {
  async getModuleState(gameId: string) {
    const { data, error } = await supabase
      .from('games')
      .select('status, processing_status, metadata')
      .eq('id', gameId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async advanceModule(gameId: string, nextStatus: string) {
    const { error } = await supabase
      .from('games')
      .update({ status: nextStatus })
      .eq('id', gameId);
    
    if (error) throw error;
  },

  async logTechnicalTrace(gameId: string, moduleId: string, message: string, severity: "info" | "warn" | "error" = "info") {
    const { error } = await supabase
      .from('game_events')
      .insert({
        game_id: gameId,
        event_type: `module_${moduleId}_trace`,
        severity,
        payload: { message, timestamp: new Date().toISOString() }
      });
    
    if (error) console.error("Trace logging failed:", error);
  }
};