import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded to your verified Modal.com GPU Cluster
 */
export const modalService = {
  /**
   * TRIGGER ANALYSIS: The Primary Ignition Command
   */
  async triggerAnalysis(options: {
    gameId: string;
    videoUrl: string;
    supabaseUrl: string;
    supabaseKey: string;
    metadata?: any;
  }) {
    const MODAL_ENDPOINT = "https://softgen--basketball-scout-ai-analyze.modal.run";
    
    try {
      console.log("📡 DISPATCHING HANDSHAKE TO MODAL:", options.gameId);
      const response = await axios.post(MODAL_ENDPOINT, {
        game_id: options.gameId,
        video_url: options.videoUrl,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        metadata: options.metadata || {},
        pipeline_mode: "analyze"
      }, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000 // 10s handshake timeout
      });

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "GPU Handshake Timeout";
      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};