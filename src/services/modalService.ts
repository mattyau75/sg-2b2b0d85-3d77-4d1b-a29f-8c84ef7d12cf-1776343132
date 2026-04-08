/**
 * Service bridge for Modal.com GPU A100 processing.
 * Updated to use the secure server-side API bridge.
 */
export const modalService = {
  /**
   * Triggers the Modal.com GPU pipeline for a YouTube URL via secure API
   */
  processGame: async (youtubeUrl: string) => {
    const response = await fetch("/api/process-game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ youtubeUrl }),
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