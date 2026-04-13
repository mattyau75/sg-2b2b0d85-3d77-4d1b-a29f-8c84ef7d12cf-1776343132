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
    // 🛡️ ULTIMATE STANDARD: Atomic Normalization
    const normalizedId = options.gameId.toLowerCase();
    const modalUser = process.env.NEXT_PUBLIC_MODAL_USER_NAME || "mattjeffs";
    const MODAL_ENDPOINT = `https://${modalUser}--basketball-scout-ai-analyze.modal.run`;

    try {
      console.log(`🚀 Dispatching Analysis to: ${MODAL_ENDPOINT}`);
      const response = await axios.post(MODAL_ENDPOINT, {
        game_id: normalizedId,
        video_url: options.videoUrl,
        metadata: options.metadata,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        pipeline_mode: 'analyze'
      }, {
        timeout: 15000 // 15s timeout for the ignition handshake
      });

      return response.data;
    } catch (error: any) {
      console.error("❌ Modal Ignition Failed:", error.response?.data || error.message);
      throw new Error(error.response?.data?.message || "GPU Cluster unreachable. Check Modal deployment.");
    }
  }
};

export const triggerAnalysis = modalService.triggerAnalysis;