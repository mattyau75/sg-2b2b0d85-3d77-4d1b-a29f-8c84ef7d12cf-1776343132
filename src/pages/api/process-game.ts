import { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Enhanced logging context
  const logContext = {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: {
      contentType: req.headers["content-type"],
      userAgent: req.headers["user-agent"],
    },
    body: req.body,
  };

  logger.info("[ProcessGame] ✅ CHECKPOINT 1: API Request received", logContext);

  if (req.method !== "POST") {
    logger.error("[ProcessGame] ❌ CHECKPOINT 1 FAILED: Invalid method", { method: req.method });
    return res.status(405).json({ 
      error: "Method not allowed",
      details: { allowed: "POST", received: req.method }
    });
  }

  try {
    logger.info("[ProcessGame] ✅ CHECKPOINT 2: Method validation passed");

    // Create Supabase client with proper cookie handling for Next.js API routes
    logger.info("[ProcessGame] ✅ CHECKPOINT 3: Creating Supabase server client");
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Object.keys(req.cookies).map((name) => ({
              name,
              value: req.cookies[name] || '',
            }));
          },
          setAll(cookiesToSet) {
            try {
              const setCookieHeaders = cookiesToSet.map(({ name, value, options }) =>
                serialize(name, value, options)
              );
              if (setCookieHeaders.length > 0) {
                res.setHeader('Set-Cookie', setCookieHeaders);
              }
            } catch (error) {
              // Ignore if headers already sent
            }
          },
        },
      }
    );

    logger.info("[ProcessGame] ✅ CHECKPOINT 4: Supabase client created successfully");

    // DIAGNOSTIC CHECKPOINT 3: Checking auth session
    logger.info("[ProcessGame] ✅ CHECKPOINT 3: Checking auth session");
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    logger.info("[ProcessGame] Session check result", {
      hasSession: !!session,
      sessionError: sessionError?.message,
      userId: session?.user?.id
    });

    if (!session) {
      logger.error("[ProcessGame] ❌ CHECKPOINT 3 FAILED: No session");
      return res.status(401).json({ 
        error: "Unauthorized - Authentication required",
        checkpoint: "AUTH_CHECK",
        details: { hasSession: false, sessionError: sessionError?.message }
      });
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
    
    const modalUrl = process.env.MODAL_USER_URL;
    const modalToken = process.env.MODAL_AUTH_TOKEN;
    
    logger.info("[ProcessGame] Modal config check", {
      hasUrl: !!modalUrl,
      hasToken: !!modalToken,
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

    const modalEndpoint = `${modalUrl}/analyze`; // FIXED: Changed from /process to /analyze

    logger.info("[ProcessGame] Modal request details", { 
      endpoint: modalEndpoint,
      payload: modalPayload,
      hasAuthHeader: !!modalToken
    });

    // DIAGNOSTIC CHECKPOINT 9: Sending request to Modal
    logger.info("[ProcessGame] ✅ CHECKPOINT 9: Dispatching to Modal GPU Worker", {
      endpoint: modalEndpoint,
      tokenPreview: modalToken ? `${modalToken.substring(0, 5)}...` : 'NONE'
    });

    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modalToken}`
      },
      body: JSON.stringify(modalPayload),
    });

    const responseText = await response.text();
    
    logger.info("[ProcessGame] Modal response received", { 
      status: response.status, 
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      responseText: responseText.substring(0, 500)
    });

    if (response.status === 401) {
      logger.error("[ProcessGame] ❌ MODAL AUTHENTICATION FAILED (401)", {
        message: "The Modal token is likely invalid or expired.",
        responseText
      });
      return res.status(401).json({
        error: "GPU Worker Authentication Failed",
        checkpoint: "MODAL_AUTH",
        details: {
          modalStatus: 401,
          modalError: responseText,
          suggestion: "Please check your MODAL_AUTH_TOKEN in Vercel settings."
        }
      });
    }

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