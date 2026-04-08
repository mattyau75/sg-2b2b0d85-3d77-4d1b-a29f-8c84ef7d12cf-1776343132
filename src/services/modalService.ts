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
    home_team_id?: string;
    away_team_id?: string;
    home_team_color?: string;
    away_team_color?: string;
  }) => {
    const response = await fetch("/api/process-game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        youtubeUrl,
        config: {
          ...config,
          imgsz: config?.imgsz || 1280,
          conf: config?.conf || 0.25,
          iou: config?.iou || 0.45,
          tracking: config?.tracking ?? true,
          agnostic_nms: config?.agnostic_nms ?? true,
          rim_detection: config?.rim_detection ?? true,
          shot_logic: config?.shot_logic ?? true,
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to process game");
    }

    return data;
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