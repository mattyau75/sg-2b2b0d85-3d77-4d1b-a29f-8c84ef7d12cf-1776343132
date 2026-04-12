import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Standardized ignition command for Module 2
 */
export const modalService = {
  triggerAnalysis: async (options: {
    gameId: string;
    videoUrl: string;
    metadata: any;
    supabaseUrl: string;
    supabaseKey: string;
  }) => {
    const MODAL_ENDPOINT = "https://your-modal-user--basketball-scout-ai-analyze.modal.run";

    try {
      const response = await axios.post(MODAL_ENDPOINT, {
        game_id: options.gameId,
        video_url: options.videoUrl,
        metadata: options.metadata,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        pipeline_mode: "analyze"
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};

export const triggerAnalysis = modalService.triggerAnalysis;