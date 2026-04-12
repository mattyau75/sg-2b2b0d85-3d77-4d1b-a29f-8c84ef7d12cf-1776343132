import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded to your verified Modal.com endpoint.
 * This service handles the Prime Handshake and GPU Ignition.
 */

export const modalService = {
  /**
   * TRIGGER ANALYSIS
   * The primary ignition command for Module 2.
   * Dispatches the secure video payload and Supabase keys to the GPU.
   */
  triggerAnalysis: async (config: {
    game_id: string;
    video_url: string;
    video_filename: string;
    supabase_url?: string;
    supabase_key?: string;
    pipeline_mode?: string;
  }) => {
    const MODAL_ENDPOINT = "https://softgenai--basketball-scout-ai-process-game.modal.run";
    
    try {
      console.log("📡 DISPATCHING HANDSHAKE TO GPU:", config.game_id);
      
      const response = await axios.post(MODAL_ENDPOINT, config, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 30000 // 30s timeout for handshake
      });

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || "GPU Endpoint Unreachable";
      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Legacy support for processGame calls
   */
  processGame: async (game_id: string, options: any) => {
    return modalService.triggerAnalysis({
      game_id,
      video_url: options.video_url || "",
      video_filename: options.video_filename || "video.mp4",
      supabase_url: options.supabaseUrl,
      supabase_key: options.supabaseKey,
      pipeline_mode: "analyze"
    });
  }
};