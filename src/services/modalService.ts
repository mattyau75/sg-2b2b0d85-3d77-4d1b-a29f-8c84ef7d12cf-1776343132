import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded for 100% Reliability with simplified naming.
 */
export const modalService = {
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // ELITE HARD-LOCKED URL
    // Format: https://{username}--{app_name}-{function_label}.modal.run
    const url = "https://mattjeffs--scout-run.modal.run";
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);

    try {
      const response = await axios.post(url, {
        game_id: gameId,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        ...options.metadata
      }, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 30000 // 30s handshake timeout
      });

      console.log("✅ GPU HANDSHAKE SUCCESSFUL:", response.data);
      return response.data;
    } catch (error: any) {
      let errorMessage = `GPU Routing Error (404): The endpoint at ${url} does not exist. Please check your Modal Dashboard for the correct URL and ensure the app is deployed.`;
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = `CRITICAL: Ignition failure - GPU Routing Error (404): The endpoint at ${url} does not exist. Please ensure you have run 'Deploy to Modal.com' in GitHub Actions.`;
        } else {
          errorMessage = `GPU Service Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.request) {
        errorMessage = "GPU Connection Timeout: The cluster is taking too long to respond. Check if it's currently deploying.";
      }

      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};