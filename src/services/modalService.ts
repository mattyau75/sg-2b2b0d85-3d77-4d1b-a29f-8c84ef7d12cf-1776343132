import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Reconstructed for absolute reliability and 404 resolution.
 */
export const modalService = {
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // MODAL URL CONSTRUCTION (Simplified & Hardened)
    // Username: mattjeffs
    // App: basketball-scout
    // Function: analyze
    const url = `https://mattjeffs--basketball-scout-analyze.modal.run`;
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);

    try {
      const response = await axios.post(url, {
        game_id: gameId,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        metadata: options.metadata || {}
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30s timeout for handshake
      });

      console.log("✅ GPU HANDSHAKE SUCCESSFUL:", response.data);
      return response.data;

    } catch (error: any) {
      // CAPTURE RAW MODAL ERROR FOR DASHBOARD TRACING
      const status = error.response?.status;
      const rawBody = error.response?.data;
      
      let errorMessage = `GPU Routing Error: ${error.message}`;
      
      if (status === 404) {
        errorMessage = `GPU Routing Error: The AI endpoint is not found (404). Please ensure you have run 'Deploy to Modal.com' in GitHub Actions.`;
      } else if (typeof rawBody === 'string' && rawBody.includes('modal-http')) {
        errorMessage = `GPU Routing Error: Received non-JSON response from Modal (likely 404). Check URL naming in modal_worker.py.`;
      }

      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};