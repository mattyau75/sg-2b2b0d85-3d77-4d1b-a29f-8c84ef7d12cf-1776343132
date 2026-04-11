import axios from "axios";

/**
 * Service bridge for Modal.com GPU A100 processing.
 */
export const modalService = {
  /**
   * Client-side: Triggers the internal Next.js API route which handles security/validation
   */
  triggerAnalysis: async (gameId: string, videoPath: string, config: any) => {
    try {
      const response = await axios.post("/api/process-game", { 
        gameId,
        videoPath,
        ...config
      });
      return response.data;
    } catch (error: any) {
      const displayMessage = error.response?.data?.message || error.message || "Unknown connection error";
      throw new Error(displayMessage);
    }
  },

  /**
   * Server-side: Directly triggers the Modal.com GPU cluster
   */
  processGame: async (signedUrl: string, config: any) => {
    try {
      // Use the explicit MODAL_WEBHOOK_URL or MODAL_URL from .env.local
      const modalEndpoint = process.env.MODAL_WEBHOOK_URL || process.env.MODAL_URL;
      if (!modalEndpoint) throw new Error("MODAL_URL is not configured in .env.local");
      
      console.log(`[ModalService] Igniting GPU Swarm at: ${modalEndpoint}`);
      console.log(`[ModalService] Payload for Game ${config.game_id}:`, {
        video_url: signedUrl.substring(0, 50) + "...",
        home_team: config.home_team_id,
        away_team: config.away_team_id
      });

      const response = await axios.post(modalEndpoint, {
        video_url: signedUrl,
        game_id: config.game_id,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Pass for direct updates
        home_team_id: config.home_team_id,
        away_team_id: config.away_team_id,
        home_color: config.homeColor || "#FFFFFF",
        away_color: config.awayColor || "#0B0F19",
        home_roster: config.home_roster || [],
        away_roster: config.away_roster || [],
        config: {
          ...config,
          temporal_tracking: true,
          shot_detection: true,
          handshake_version: "2.0"
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("[ModalService] GPU Cluster Handoff Failed:", error.response?.data || error.message);
      throw error;
    }
  }
};