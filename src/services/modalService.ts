import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded to your verified Dashboard URL for 100% Reliability.
 */
export const modalService = {
  processGame: async (game_id: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // YOUR VERIFIED MODAL DASHBOARD URL
    const url = "https://mattjeffs--basketball-scout-ai-analyze.modal.run";
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);

    try {
      const response = await axios.post(url, {
        game_id: game_id,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey, // This is the Service Role Key
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
      let errorMessage = `GPU Routing Error: The endpoint at ${url} is unreachable.`;
      
      if (error.response) {
        errorMessage = `❌ GPU REJECTED REQUEST (${error.response.status}): ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage = `⚠️ GPU TIMEOUT: No response from ${url}. Check your Modal Dashboard for errors.`;
      }

      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};