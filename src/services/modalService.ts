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
    // MODAL URL RULES:
    // 1. User name and App name must be separated by DOUBLE DASH (--)
    // 2. App name and Function name must be separated by SINGLE DASH (-)
    // 3. Entire string must be lowercase
    const userName = (process.env.MODAL_USER_NAME || "dribblestats").toLowerCase().replace(/_/g, "-");
    const appName = "basketball-scout-gpu";
    const functionName = "process-game-factory";
    
    const url = `https://${userName}--${appName}-${functionName}.modal.run`;
    
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