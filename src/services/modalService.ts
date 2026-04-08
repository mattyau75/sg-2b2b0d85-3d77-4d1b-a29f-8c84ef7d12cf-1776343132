/**
 * Service bridge for Modal.com GPU A100 processing.
 * Updated to use the secure server-side API bridge.
 */
export const modalService = {
  /**
   * Triggers the Modal.com GPU pipeline for a YouTube URL via secure API
   * Now supports optimized inference settings for small object detection
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
      // Use window.location.origin to ensure absolute pathing
      const apiEndpoint = `${window.location.origin}/api/process-game`;
      
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
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
        }),
      });

      const data = await response.json().catch(() => ({ message: "Failed to parse error response" }));

      if (!response.ok) {
        // Prioritize the string 'message' over the 'details' object to avoid [object Object]
        const errorMessage = typeof data.message === "string" ? data.message : (typeof data.error === "string" ? data.error : "Failed to process game");
        throw new Error(errorMessage);
      }

      return data;
    } catch (error: any) {
      const displayMessage = error.message || "Unknown connection error";
      const userMessage = displayMessage.includes("timed out") 
        ? `Timeout: ${displayMessage}`
        : `Connection Error: ${displayMessage}`;
      
      alert(userMessage);
      throw error;
    }
  },

  /**
   * Simulated status check for a running job
   */
  getJobStatus: async (jobId: string) => {
    return {
      status: "processing",
      progress: 45,
      currentTask: "Detecting shot attempts via YOLOv11m"
    };
  }
};