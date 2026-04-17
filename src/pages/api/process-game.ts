import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { gameId } = req.body;
  const timestamp = new Date().toISOString();
  
  logger.info("[ProcessGame] ✅ API Request Received", { gameId, timestamp });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Initial validation
    if (!gameId) {
      return res.status(400).json({ error: "Missing required field: gameId" });
    }

    // 2. Fetch game details
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: "Game not found", details: gameError });
    }

    // 3. Construct video URL
    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith("http")) {
      const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, "");
      if (r2Endpoint) videoUrl = `${r2Endpoint}/${videoUrl}`;
    }

    if (!videoUrl) {
      return res.status(400).json({ error: "No video file associated with this game" });
    }

    // 4. PRE-IGNITION: Update status to prevent frontend timeout
    await supabase
      .from("games")
      .update({ 
        ignition_status: "ignited",
        processing_status: "analyzing",
        status_message: "GPU Dispatching..." 
      })
      .eq("id", gameId);

    // 5. Industrial Standard URL Construction
    const rawModalUrl = (process.env.MODAL_USER_URL || "").trim();
    if (!rawModalUrl) {
      return res.status(500).json({ error: "MODAL_USER_URL not configured" });
    }

    // Standardize: Strip quotes, strip trailing slash, ensure single /analyze suffix
    const cleanBaseUrl = rawModalUrl.replace(/['"]+/g, "").replace(/\/+$/, "").replace(/\/analyze$/, "");
    const modalEndpoint = `${cleanBaseUrl}/analyze`;

    const rawModalToken = (process.env.MODAL_AUTH_TOKEN || "").trim();
    const modalToken = rawModalToken.replace(/['"]+/g, "");

    if (!modalToken) {
      return res.status(500).json({ error: "MODAL_AUTH_TOKEN not configured" });
    }

    const modalPayload = {
      game_id: gameId,
      video_url: videoUrl,
      config: req.body.config || {}
    };

    logger.info("[ProcessGame] 🚀 DISPATCHING TO GPU", { 
      gameId, 
      endpoint: modalEndpoint 
    });

    // 6. Execute Dispatch
    const response = await fetch(modalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modalToken}`
      },
      body: JSON.stringify(modalPayload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error("[ProcessGame] ❌ GPU Dispatch Failed", { status: response.status, body: responseText });
      
      // Revert status on failure
      await supabase
        .from("games")
        .update({ 
          ignition_status: "failed",
          status_message: `GPU Error: ${response.status}` 
        })
        .eq("id", gameId);

      return res.status(response.status).json({ 
        error: "GPU Dispatch Failed", 
        details: responseText,
        status: response.status 
      });
    }

    const responseData = JSON.parse(responseText);
    
    return res.status(200).json({ 
      success: true, 
      message: "GPU cluster acknowledged request", 
      result: responseData 
    });

  } catch (err: any) {
    logger.error("[ProcessGame] ❌ UNEXPECTED ERROR", { error: err.message });
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}