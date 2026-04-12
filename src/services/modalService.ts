import axios from "axios";

/**
 * Service bridge for Modal.com GPU A100 processing.
 */
export const modalService = {
  /**
   * Client-side: Triggers the internal Next.js API route which handles security/validation
   */
  triggerAnalysis: async (gameId: string, videoPath: string, config: any) => {
    try {
      const response = await axios.post("/api/process-game", { 
        gameId,
        videoPath,
        ...config
      });
      return response.data;
    } catch (error: any) {
      const displayMessage = error.response?.data?.message || error.message || "Unknown connection error";
      throw new Error(displayMessage);
    }
  },

  /**
   * Server-side: Directly triggers the Modal.com GPU cluster
   */
  processGame: async (gameId: string, options: { 
    supabaseUrl: string, 
    supabaseKey: string, 
    metadata?: any 
  }) => {
    const userName = process.env.MODAL_USER_NAME || "dribblestats";
    const appName = process.env.MODAL_APP_NAME || "dribble-swarm";
    const url = `https://${userName}-${appName}-process-game-factory.modal.run`;
    
    console.log(`🚀 Attempting GPU Ignition at: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          game_id: gameId,
          supabase_url: options.supabaseUrl,
          supabase_key: options.supabaseKey,
          metadata: options.metadata || {}
        })
      });

      const result = await response.json();
      console.log("✅ GPU Ignition Response:", { status: response.status, result });
      
      if (!response.ok) {
        throw new Error(result.error || `GPU Ignition failed with status ${response.status}`);
      }
      
      return result;
    } catch (error: any) {
      console.error("❌ GPU Ignition Error:", error);
      throw error;
    }
  }
};