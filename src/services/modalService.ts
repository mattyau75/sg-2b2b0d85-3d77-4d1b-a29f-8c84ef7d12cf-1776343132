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
   * Server-side: Directly triggers the Modal.com GPU cluster (Modal.com Webhook)
   * This is called by the /api/process-game endpoint.
   */
  processGame: async (videoPath: string, config: any) => {
    try {
      // Replace with your actual Modal.com App URL (e.g. https://user--app-name.modal.run)
      // This MUST be the external URL, not the internal API route
      const modalEndpoint = process.env.MODAL_WEBHOOK_URL;
      
      if (!modalEndpoint) {
        console.error("[ModalService] Missing MODAL_WEBHOOK_URL in environment variables");
        throw new Error("Modal.com GPU cluster endpoint not configured");
      }

      console.log(`[ModalService] Dispatching job to GPU Cluster: ${modalEndpoint}`);
      
      const response = await axios.post(modalEndpoint, {
        video_url: videoPath,
        game_id: config.gameId,
        home_color: config.homeColor || "#FFFFFF",
        away_color: config.awayColor || "#0B0F19",
        config: {
          ...config,
          imgsz: 1280,
          conf: 0.25,
          iou: 0.45,
          tracking: true,
          agnostic_nms: true,
          rim_detection: true,
          shot_logic: true,
          camera_type: "panning",
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Token': process.env.MODAL_AUTH_TOKEN || ''
        }
      });

      return response.data;
    } catch (error: any) {
      console.error("[ModalService] GPU Cluster Handoff Failed:", error.response?.data || error.message);
      throw error;
    }
  }
};