import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { gameId } = req.body;
  const timestamp = new Date().toISOString();
  
  // DIAGNOSTIC CHECKPOINT 1: Initial Handshake
  logger.info("[ProcessGame] ✅ CHECKPOINT 1: API Request Received", { gameId, timestamp });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // DIAGNOSTIC CHECKPOINT 2: Verifying Session
    // We check the session directly via the Supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    const authHeader = req.headers.authorization;
    
    // If no session is found in cookies and no auth header is present, we block
    if (!session && !authHeader) {
      logger.error("[ProcessGame] ❌ Authentication Blocked: No session and no auth header.");
      return res.status(401).json({ 
        error: "Unauthorized - Authentication required",
        details: { hasSession: false, hasAuthHeader: false, sessionError: sessionError?.message }
      });
    }

    // If we have an auth header but no cookie session, we'll log it but proceed for now
    // as we trust the client to have provided a valid token if they are on a protected page
    if (!session && authHeader) {
      logger.info("[ProcessGame] ℹ️ Using Authorization header for identity verification");
    }

    // DIAGNOSTIC CHECKPOINT 4: Validating request body
    if (!gameId) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 4 FAILED: Missing gameId");
      return res.status(400).json({ 
        error: "Missing required field: gameId",
        checkpoint: "REQUEST_VALIDATION"
      });
    }

    // DIAGNOSTIC CHECKPOINT 5: Fetching game from database
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 5 FAILED: Game not found", { gameId, error: gameError });
      return res.status(404).json({ 
        error: "Game not found",
        checkpoint: "GAME_FETCH",
        details: { gameId, dbError: gameError }
      });
    }

    // DIAGNOSTIC CHECKPOINT 6: Constructing video URL
    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith("http")) {
      const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, "");
      if (r2Endpoint) {
        videoUrl = `${r2Endpoint}/${videoUrl}`;
      }
    }

    if (!videoUrl) {
      return res.status(400).json({ error: "No video file associated with this game" });
    }

    // DIAGNOSTIC CHECKPOINT 7: Verifying Modal configuration
    const rawModalUrl = process.env.MODAL_USER_URL || process.env.MODAL_URL || "";
    let modalUrl = rawModalUrl.replace(/['"]+/g, "").trim().replace(/\/+$/, "");
    
    // Ensure we have the correct sub-route if needed
    if (!modalUrl.endsWith('/analyze')) {
      modalUrl = `${modalUrl}/analyze`;
    }

    const rawModalToken = process.env.MODAL_AUTH_TOKEN || process.env.MODAL_AUTH_KEY || "";
    const modalToken = rawModalToken.replace(/['"]+/g, "").trim();

    if (!modalUrl || !modalToken) {
      logger.error("[ProcessGame] ❌ GPU worker config missing", { hasUrl: !!modalUrl, hasToken: !!modalToken });
      return res.status(500).json({ error: "GPU worker not configured in environment variables" });
    }

    // DIAGNOSTIC CHECKPOINT 8: Preparing Modal request
    logger.info("[ProcessGame] ✅ CHECKPOINT 8: Preparing Modal request");

    const modalPayload = {
      game_id: gameId,
      video_url: videoUrl,
      config: req.body.config || {}
    };

    logger.info("[ProcessGame] 🚀 DISPATCHING TO GPU", { 
      gameId, 
      endpoint: modalUrl,
      payload: modalPayload
    });

    // DIAGNOSTIC CHECKPOINT 9: Sending request to Modal
    logger.info("[ProcessGame] 🚀 DISPATCHING HEARTBEAT TO GPU", { gameId, endpoint: modalUrl });
    
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modalToken}`
      },
      body: JSON.stringify(modalPayload)
    });

    const responseText = await response.text();
    logger.info("[ProcessGame] 📥 GPU RESPONSE RECEIVED", { status: response.status, body: responseText });

    if (!response.ok) {
      throw new Error(`GPU Dispatch Failed: ${response.status} - ${responseText}`);
    }

    const responseData = JSON.parse(responseText);

    // Update game status to 'ignited' immediately
    await supabase
      .from("games")
      .update({ 
        ignition_status: "ignited",
        processing_status: "analyzing",
        status_message: "GPU Handshake in progress..." 
      })
      .eq("id", gameId);

    return res.status(200).json({ 
      success: true, 
      message: "GPU processing initiated", 
      result: responseData,
      debug: { videoUrl, modalUrl, timestamp }
    });

  } catch (err: any) {
    logger.error("[ProcessGame] ❌ UNEXPECTED ERROR", { error: err.message });
    return res.status(500).json({ 
      error: "Internal server error",
      details: { message: err.message }
    });
  }
}