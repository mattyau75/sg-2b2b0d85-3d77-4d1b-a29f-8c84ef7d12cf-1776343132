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
      const modalEndpoint = process.env.MODAL_WEBHOOK_URL;
      if (!modalEndpoint) throw new Error("MODAL_WEBHOOK_URL is not configured");
      
      const response = await axios.post(modalEndpoint, {
        video_url: signedUrl,
        game_id: config.gameId,
        home_team: config.home_team_id,
        away_team: config.away_team_id,
        home_color: config.homeColor || "#FFFFFF",
        away_color: config.awayColor || "#0B0F19",
        home_roster: config.home_roster || [],
        away_roster: config.away_roster || [],
        config: {
          ...config,
          temporal_tracking: true,
          shot_detection: true
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("[ModalService] GPU Cluster Handoff Failed:", error.response?.data || error.message);
      throw error;
    }
  }
};