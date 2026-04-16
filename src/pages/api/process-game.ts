import { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enhanced logging context
  const logContext = {
    method: req.method,
    url: req.url,
    headers: {
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    },
    body: req.body,
  };

  logger.info("[ProcessGame] API Request received", logContext);

  if (req.method !== "POST") {
    logger.error("[ProcessGame] Invalid method", { method: req.method });
    return res.status(405).json({ 
      error: "Method not allowed",
      details: { allowed: "POST", received: req.method }
    });
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { req, res } as any
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      logger.error("[ProcessGame] Unauthorized - No session");
      return res.status(401).json({ 
        error: "Unauthorized - Authentication required",
        details: { hasSession: false }
      });
    }

    const { gameId } = req.body;

    if (!gameId) {
      logger.error("[ProcessGame] Missing gameId", { body: req.body });
      return res.status(400).json({ 
        error: "Missing required field: gameId",
        details: { received: req.body }
      });
    }

    logger.info("[ProcessGame] Fetching game data", { gameId });

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      logger.error("[ProcessGame] Game not found", { gameId, error: gameError });
      return res.status(404).json({ 
        error: "Game not found",
        details: { gameId, dbError: gameError }
      });
    }

    // Construct public R2 URL for Modal worker
    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith('http')) {
      const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, '');
      if (!r2Endpoint) {
        logger.error("[ProcessGame] R2_ENDPOINT not configured", {
          envVars: {
            hasR2Endpoint: !!process.env.NEXT_PUBLIC_R2_ENDPOINT,
            hasR2Domain: !!process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN,
          }
        });
        return res.status(500).json({ 
          error: "R2 endpoint not configured",
          details: { 
            message: "NEXT_PUBLIC_R2_ENDPOINT environment variable is missing",
            envVarsPresent: Object.keys(process.env).filter(k => k.includes('R2'))
          }
        });
      }
      videoUrl = `${r2Endpoint}/${videoUrl}`;
    }

    if (!videoUrl) {
      logger.error("[ProcessGame] No video path", { gameId, game });
      return res.status(400).json({ 
        error: "No video file associated with this game",
        details: { gameId, videoPath: game.video_path }
      });
    }

    // Verify Modal configuration
    const modalUrl = process.env.MODAL_USER_URL;
    const modalToken = process.env.MODAL_AUTH_TOKEN;
    
    if (!modalUrl || !modalToken) {
      logger.error("[ProcessGame] Modal not configured", { 
        hasUrl: !!modalUrl, 
        hasToken: !!modalToken,
        envVars: Object.keys(process.env).filter(k => k.includes('MODAL'))
      });
      return res.status(500).json({ 
        error: "GPU worker not configured",
        details: { 
          message: "MODAL_USER_URL or MODAL_AUTH_TOKEN missing",
          hasUrl: !!modalUrl,
          hasToken: !!modalToken,
          availableModalVars: Object.keys(process.env).filter(k => k.includes('MODAL'))
        }
      });
    }

    logger.info(`[ProcessGame] Dispatching to Modal GPU Worker`, { 
      gameId, 
      videoUrl,
      modalUrl,
      hasToken: !!modalToken
    });

    const modalPayload = {
      gameId: String(gameId),
      videoUrl: String(videoUrl),
      config: req.body.config || {}
    };

    logger.info("[ProcessGame] Modal request payload", modalPayload);

    const response = await fetch(`${modalUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modalToken}`
      },
      body: JSON.stringify(modalPayload),
    });

    const responseText = await response.text();
    logger.info("[ProcessGame] Modal response", { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText
    });

    if (!response.ok) {
      logger.error("[ProcessGame] Modal API error", { 
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
        requestPayload: modalPayload
      });
      return res.status(500).json({ 
        error: "GPU Worker dispatch failed",
        details: {
          modalStatus: response.status,
          modalError: responseText,
          modalUrl: `${modalUrl}/process`,
          requestSent: modalPayload
        }
      });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    logger.info("[ProcessGame] GPU processing initiated successfully", { gameId, result });
    return res.status(200).json({ 
      success: true, 
      message: "GPU processing initiated", 
      result,
      debug: {
        videoUrl,
        modalEndpoint: `${modalUrl}/process`
      }
    });

  } catch (err: any) {
    logger.error("[ProcessGame] Unexpected error", {
      error: err.message,
      stack: err.stack,
      name: err.name,
      request: logContext
    });
    return res.status(500).json({ 
      error: "Internal server error",
      details: {
        message: err.message,
        stack: err.stack,
        type: err.name
      }
    });
  }
}