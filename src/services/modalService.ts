import axios from "axios";

/**
 * ELITE MODAL SERVICE BRIDGE
 * Hard-coded for 100% Reliability to solve 404 Routing Errors.
 */
export const modalService = {
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    // MODAL URL ARCHITECTURE:
    // https://{username}--{app_name}-{function_name}.modal.run
    // Username: mattjeffs
    // App Name: basketball-scout
    // Function: analyze
    const url = "https://mattjeffs--basketball-scout-analyze.modal.run";
    
    console.log(`🚀 IGNITING GPU CLUSTER AT: ${url}`);

    try {
      const response = await axios.post(url, {
        game_id: gameId,
        supabase_url: options.supabaseUrl,
        supabase_key: options.supabaseKey,
        metadata: options.metadata
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10s timeout for handshake
      });

      return response.data;
    } catch (error: any) {
      let errorMessage = "AI Ignition Failed";
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = `GPU Routing Error: The AI endpoint is not found (404). URL Attempted: ${url}`;
        } else {
          errorMessage = `GPU Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
        }
      } else if (error.request) {
        errorMessage = "No response from GPU Cluster. Check Modal.com logs.";
      } else {
        errorMessage = error.message;
      }

      console.error("❌ GPU IGNITION FAILURE:", errorMessage);
      throw new Error(errorMessage);
    }
  }
};