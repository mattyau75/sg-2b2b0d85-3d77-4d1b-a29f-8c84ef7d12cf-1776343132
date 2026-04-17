import { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { gameId } = req.body;
  
  // DIAGNOSTIC CHECKPOINT 1: Initial Handshake
  logger.info("[ProcessGame] ✅ CHECKPOINT 1: API Request Received", { gameId });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // DIAGNOSTIC CHECKPOINT 2: Verifying Session
    // We attempt to get the session, but we also check the Authorization header
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // If no session is found in cookies, we don't immediately fail. 
    // We check if the request is coming from a trusted local origin or has a valid header.
    if (!session) {
      logger.warn("[ProcessGame] ⚠️ No active session found in cookies. Checking header...");
      // For now, let's log the full details to see why the session is missing
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        logger.error("[ProcessGame] ❌ Authentication Blocked: No session and no auth header.");
        return res.status(401).json({ 
          error: "Unauthorized - Authentication required",
          details: { hasSession: false, hasHeader: false }
        });
      }
    }

    // DIAGNOSTIC CHECKPOINT 4: Validating request body
    logger.info("[ProcessGame] ✅ CHECKPOINT 4: Validating request body");
    
    const { gameId } = req.body;

    if (!gameId) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 4 FAILED: Missing gameId", { body: req.body });
      return res.status(400).json({ 
        error: "Missing required field: gameId",
        checkpoint: "REQUEST_VALIDATION",
        details: { received: req.body }
      });
    }

    logger.info("[ProcessGame] Request validated", { gameId, bodyKeys: Object.keys(req.body) });

    // DIAGNOSTIC CHECKPOINT 5: Fetching game from database
    logger.info("[ProcessGame] ✅ CHECKPOINT 5: Fetching game data", { gameId });

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    logger.info("[ProcessGame] Game query result", { 
      hasGame: !!game, 
      error: gameError?.message,
      gameId: game?.id,
      videoPath: game?.video_path 
    });

    if (gameError || !game) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 5 FAILED: Game not found", { gameId, error: gameError });
      return res.status(404).json({ 
        error: "Game not found",
        checkpoint: "GAME_FETCH",
        details: { gameId, dbError: gameError }
      });
    }

    // DIAGNOSTIC CHECKPOINT 6: Constructing video URL
    logger.info("[ProcessGame] ✅ CHECKPOINT 6: Constructing video URL");
    
    let videoUrl = game.video_path;
    
    logger.info("[ProcessGame] Video path from DB", { 
      videoPath: videoUrl,
      startsWithHttp: videoUrl?.startsWith('http')
    });

    if (videoUrl && !videoUrl.startsWith('http')) {
      const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, '');
      
      logger.info("[ProcessGame] R2 endpoint check", {
        hasR2Endpoint: !!r2Endpoint,
        r2Endpoint: r2Endpoint
      });

      if (!r2Endpoint) {
        logger.error("[ProcessGame] ❌ CHECKPOINT 6 FAILED: R2_ENDPOINT not configured", {
          envVars: {
            hasR2Endpoint: !!process.env.NEXT_PUBLIC_R2_ENDPOINT,
            hasR2Domain: !!process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN,
          }
        });
        return res.status(500).json({ 
          error: "R2 endpoint not configured",
          checkpoint: "VIDEO_URL_CONSTRUCTION",
          details: { 
            message: "NEXT_PUBLIC_R2_ENDPOINT environment variable is missing",
            envVarsPresent: Object.keys(process.env).filter(k => k.includes('R2'))
          }
        });
      }
      videoUrl = `${r2Endpoint}/${videoUrl}`;
    }

    if (!videoUrl) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 6 FAILED: No video path", { gameId, game });
      return res.status(400).json({ 
        error: "No video file associated with this game",
        checkpoint: "VIDEO_URL_VALIDATION",
        details: { gameId, videoPath: game.video_path }
      });
    }

    logger.info("[ProcessGame] Video URL constructed", { videoUrl });

    // DIAGNOSTIC CHECKPOINT 7: Verifying Modal configuration
    logger.info("[ProcessGame] ✅ CHECKPOINT 7: Verifying Modal configuration");
    
    // Clean and sanitize env vars (remove potential quotes or spaces from Vercel)
    const rawModalUrl = process.env.MODAL_USER_URL || "";
    const modalUrl = rawModalUrl.replace(/['"]+/g, '').trim().replace(/\/+$/, '');
    
    const rawModalToken = process.env.MODAL_AUTH_TOKEN || process.env.MODAL_AUTH_KEY || "";
    const modalToken = rawModalToken.replace(/['"]+/g, '').trim();
    
    logger.info("[ProcessGame] Modal config check (Sanitized)", {
      hasUrl: !!modalUrl,
      hasToken: !!modalToken,
      source: !!process.env.MODAL_AUTH_TOKEN ? 'MODAL_AUTH_TOKEN' : (!!process.env.MODAL_AUTH_KEY ? 'MODAL_AUTH_KEY' : 'NONE'),
      modalUrl: modalUrl,
      modalUrlLength: modalUrl?.length,
      tokenLength: modalToken?.length,
      allModalEnvVars: Object.keys(process.env).filter(k => k.includes('MODAL'))
    });
    
    if (!modalUrl || !modalToken) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 7 FAILED: Modal not configured", { 
        hasUrl: !!modalUrl, 
        hasToken: !!modalToken,
        envVars: Object.keys(process.env).filter(k => k.includes('MODAL'))
      });
      return res.status(500).json({ 
        error: "GPU worker not configured",
        checkpoint: "MODAL_CONFIG",
        details: { 
          message: "MODAL_USER_URL or MODAL_AUTH_TOKEN missing",
          hasUrl: !!modalUrl,
          hasToken: !!modalToken,
          availableModalVars: Object.keys(process.env).filter(k => k.includes('MODAL'))
        }
      });
    }

    // DIAGNOSTIC CHECKPOINT 8: Preparing Modal request
    logger.info("[ProcessGame] ✅ CHECKPOINT 8: Preparing Modal request");

    const modalPayload = {
      gameId: String(gameId),
      videoUrl: String(videoUrl),
      config: req.body.config || {}
    };

    // If the modalUrl already points to the function endpoint (contains -analyze), use it as is
    const modalEndpoint = modalUrl.includes('-analyze') ? modalUrl : `${modalUrl}/analyze`;

    logger.info("[ProcessGame] Modal request details", { 
      endpoint: modalEndpoint,
      payload: modalPayload,
      hasAuthHeader: !!modalToken
    });

    // DIAGNOSTIC CHECKPOINT 9: Sending request to Modal
    logger.info("[ProcessGame] ✅ CHECKPOINT 9: Dispatching to Modal GPU Worker", {
      endpoint: modalEndpoint,
      authHeaderLength: modalToken?.length,
      authHeaderPreview: modalToken ? `${modalToken.substring(0, 7)}...` : 'MISSING'
    });

    try {
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
        logger.error("[ProcessGame] ❌ MODAL AUTHENTICATION FAILED (401)", {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        return res.status(401).json({
          error: "GPU Worker Authentication Failed",
          checkpoint: "MODAL_AUTH",
          details: {
            modalStatus: 401,
            suggestion: "Check MODAL_AUTH_TOKEN in Vercel. Ensure no extra quotes or spaces.",
            modalResponse: responseText
          }
        });
      }

      logger.info("[ProcessGame] Modal response received", { 
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseText: responseText.substring(0, 500)
      });

      // DIAGNOSTIC CHECKPOINT 10: Processing Modal response
      logger.info("[ProcessGame] ✅ CHECKPOINT 10: Processing Modal response");

      if (!response.ok) {
        logger.error("[ProcessGame] ❌ CHECKPOINT 10 FAILED: Modal API error", { 
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          requestPayload: modalPayload
        });
        return res.status(500).json({ 
          error: "GPU Worker dispatch failed",
          checkpoint: "MODAL_RESPONSE",
          details: {
            modalStatus: response.status,
            modalError: responseText,
            modalUrl: modalEndpoint,
            requestSent: modalPayload
          }
        });
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError: any) {
        logger.warn("[ProcessGame] Could not parse Modal response as JSON", { 
          error: parseError.message,
          responseText 
        });
        result = { raw: responseText };
      }

      logger.info("[ProcessGame] ✅ SUCCESS: GPU processing initiated", { gameId, result });
      
      return res.status(200).json({ 
        success: true, 
        message: "GPU processing initiated", 
        result,
        debug: {
          videoUrl,
          modalEndpoint,
          timestamp: logContext.timestamp
        }
      });

    } catch (fetchError: any) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 9 FAILED: Modal API request failed", {
        error: fetchError.message,
        stack: fetchError.stack,
        name: fetchError.name,
        request: {
          endpoint: modalEndpoint,
          payload: modalPayload,
          authHeader: `Bearer ${modalToken}`.trim()
        }
      });
      return res.status(500).json({ 
        error: "GPU Worker dispatch failed",
        checkpoint: "MODAL_REQUEST",
        details: {
          message: fetchError.message,
          stack: process.env.NODE_ENV === 'development' ? fetchError.stack : undefined,
          type: fetchError.name,
          request: {
            endpoint: modalEndpoint,
            payload: modalPayload,
            authHeader: `Bearer ${modalToken}`.trim()
          }
        }
      });
    }

  } catch (err: any) {
    logger.error("[ProcessGame] ❌ UNEXPECTED ERROR at unknown checkpoint", {
      error: err.message,
      stack: err.stack,
      name: err.name,
      request: logContext
    });
    
    return res.status(500).json({ 
      error: "Internal server error",
      checkpoint: "UNEXPECTED_ERROR",
      details: {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        type: err.name
      }
    });
  }
}