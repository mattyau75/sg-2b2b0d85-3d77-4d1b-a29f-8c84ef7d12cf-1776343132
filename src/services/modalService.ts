import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded to your specific Dashboard URL for 100% Reliability.
 */
export const modalService = {
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // YOUR VERIFIED MODAL DASHBOARD URL
    const url = "https://mattjeffs--basketball-scout-ai-analyze.modal.run";
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);

    try {
      const response = await axios.post(url, {
        game_id: gameId,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        ...options.metadata
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second handshake timeout
      });

      console.log("✅ GPU HANDSHAKE SUCCESSFUL:", response.data);
      return response.data;
    } catch (error: any) {
      let errorMessage = "GPU Routing Error (404): The endpoint at " + url + " does not exist. Please ensure you have run 'Deploy to Modal.com' in GitHub Actions.";
      
      if (error.response) {
        errorMessage = `❌ GPU REJECTED REQUEST (${error.response.status}): ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage = `⚠️ GPU TIMEOUT: No response from ${url}. The cluster may be cold-starting.`;
      }

      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};