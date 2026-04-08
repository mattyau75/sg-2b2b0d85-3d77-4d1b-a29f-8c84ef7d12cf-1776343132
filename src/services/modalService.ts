import axios from "axios";

/**
 * Service bridge for Modal.com GPU A100 processing.
 * Updated to use the secure server-side API bridge.
 */
export const modalService = {
  /**
   * Triggers the Modal.com GPU pipeline for a YouTube URL via secure API
   */
  processGame: async (youtubeUrl: string, config?: {
    imgsz?: number;
    conf?: number;
    iou?: number;
    tracking?: boolean;
    agnostic_nms?: boolean;
    rim_detection?: boolean;
    shot_logic?: boolean;
    camera_type?: "panning" | "fixed";
    home_team_id?: string;
    away_team_id?: string;
    home_team_color?: string;
    away_team_color?: string;
    gameId?: string;
  }) => {
    try {
      const response = await axios.post("/api/process-game", { 
        youtubeUrl,
        gameId: config?.gameId,
        config: {
          ...config,
          imgsz: config?.imgsz || 1280,
          conf: config?.conf || 0.25,
          iou: config?.iou || 0.45,
          tracking: config?.tracking ?? true,
          agnostic_nms: config?.agnostic_nms ?? true,
          rim_detection: config?.rim_detection ?? true,
          shot_logic: config?.shot_logic ?? true,
          camera_type: config?.camera_type || "panning",
        }
      });

      return response.data;
    } catch (error: any) {
      const displayMessage = error.response?.data?.message || error.message || "Unknown connection error";
      throw new Error(displayMessage);
    }
  },

  /**
   * Simulated status check for a running job
   */
  getJobStatus: async (_jobId: string) => {
    return {
      status: "processing",
      progress: 45,
      currentTask: "Detecting shot attempts via YOLOv11m"
    };
  }
};