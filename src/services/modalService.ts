import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded for 100% Reliability
 * URL: https://mattjeffs--scout-run.modal.run
 */
export const modalService = {
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // ELITE HARD-LOCKED URL
    const url = "https://mattjeffs--scout-run.modal.run";
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);
    console.log(`📦 PAYLOAD:`, { game_id: gameId });

    try {
      const response = await axios.post(url, {
        game_id: gameId,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        ...options.metadata
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second handshake timeout
      });

      console.log("✅ GPU RESPONSE:", response.data);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Unknown Routing Error";
      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      
      // Detailed logging for 404 forensic
      if (error.response?.status === 404) {
        console.error("🚨 404 DETECTED: The endpoint does not exist. Verify the URL matches your Modal dashboard.");
      }
      
      throw new Error(errorMessage);
    }
  }
};