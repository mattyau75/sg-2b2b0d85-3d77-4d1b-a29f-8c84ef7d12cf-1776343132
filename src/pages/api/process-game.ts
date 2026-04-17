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
    
    // If no session is found in cookies, we check if the request is coming with a valid header
    if (!session && !req.headers.authorization) {
      logger.error("[ProcessGame] ❌ Authentication Blocked: No session and no auth header.");
      return res.status(401).json({ 
        error: "Unauthorized - Authentication required",
        details: { hasSession: false, sessionError: sessionError?.message }
      });
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
    const rawModalUrl = process.env.MODAL_USER_URL || "";
    const modalUrl = rawModalUrl.replace(/['"]+/g, "").trim().replace(/\/+$/, "");
    
    const rawModalToken = process.env.MODAL_AUTH_TOKEN || process.env.MODAL_AUTH_KEY || "";
    const modalToken = rawModalToken.replace(/['"]+/g, "").trim();
    
    if (!modalUrl || !modalToken) {
      return res.status(500).json({ error: "GPU worker not configured" });
    }

    // DIAGNOSTIC CHECKPOINT 8: Preparing Modal request
    const modalPayload = {
      gameId: String(gameId),
      videoUrl: String(videoUrl),
      config: req.body.config || {}
    };

    const modalEndpoint = modalUrl.includes("-analyze") ? modalUrl : `${modalUrl}/analyze`;

    // DIAGNOSTIC CHECKPOINT 9: Sending request to Modal
    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modalToken}`.trim()
      },
      body: JSON.stringify(modalPayload),
    });

    const responseText = await response.text();
    
    if (response.status === 401) {
      return res.status(401).json({
        error: "GPU Worker Authentication Failed",
        details: { modalResponse: responseText }
      });
    }

    if (!response.ok) {
      return res.status(500).json({ 
        error: "GPU Worker dispatch failed",
        details: { modalStatus: response.status, modalError: responseText }
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { raw: responseText };
    }

    return res.status(200).json({ 
      success: true, 
      message: "GPU processing initiated", 
      result,
      debug: { videoUrl, modalEndpoint, timestamp }
    });

  } catch (err: any) {
    logger.error("[ProcessGame] ❌ UNEXPECTED ERROR", { error: err.message });
    return res.status(500).json({ 
      error: "Internal server error",
      details: { message: err.message }
    });
  }
}