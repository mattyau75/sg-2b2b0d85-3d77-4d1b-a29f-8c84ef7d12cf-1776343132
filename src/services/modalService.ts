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
    console.log("Service: Initiating GPU process request for", youtubeUrl);
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

      const data = await response.json();

      if (!response.ok) {
        console.error("Service: GPU Request Failed (API Error):", data);
        const errorMessage = data.details || data.message || "Failed to process game";
        throw new Error(errorMessage);
      }

      return data;
    } catch (error: any) {
      console.error("Service: GPU Request Failed (Network/Client Error):", error);
      
      // Extract the most useful message from the error object
      let displayMessage = "Unknown connection error";
      
      if (typeof error === "string") {
        displayMessage = error;
      } else if (error.message) {
        displayMessage = error.message;
      } else if (typeof error === "object") {
        try {
          displayMessage = JSON.stringify(error);
        } catch {
          displayMessage = "Complex connection error";
        }
      }

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