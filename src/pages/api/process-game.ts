import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { 
        req, 
        res,
        cookieOptions: {
          name: "sb-hoqnqzghpkppewhhxrfv-auth-token",
          domain: process.env.NODE_ENV === "production" ? ".dribblestats.com.au" : undefined,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        }
      } as any
    );
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return res.status(401).json({ error: "Unauthorized access blocked." });

    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: "Game ID required" });

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      logger.error("[ProcessGame] Game not found", { gameId, error: gameError });
      return res.status(404).json({ error: "Game not found" });
    }

    // Construct public R2 URL for Modal worker
    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith('http')) {
      const r2Endpoint = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, '');
      if (!r2Endpoint) {
        logger.error("[ProcessGame] R2_ENDPOINT not configured");
        return res.status(500).json({ error: "R2 endpoint not configured" });
      }
      // Use full path as-is (e.g., "videos/filename.mp4")
      videoUrl = `${r2Endpoint}/${videoUrl}`;
    }

    if (!videoUrl) {
      logger.error("[ProcessGame] No video path found", { gameId });
      return res.status(400).json({ error: "No video file associated with this game" });
    }

    // Verify Modal configuration
    const modalUrl = process.env.MODAL_USER_URL;
    const modalToken = process.env.MODAL_AUTH_TOKEN;
    
    if (!modalUrl || !modalToken) {
      logger.error("[ProcessGame] Modal not configured", { 
        hasUrl: !!modalUrl, 
        hasToken: !!modalToken 
      });
      return res.status(500).json({ error: "GPU worker not configured. Check Modal environment variables." });
    }

    logger.info(`[ProcessGame] Dispatching GPU Worker`, { 
      gameId, 
      videoUrl,
      modalUrl 
    });

    const response = await fetch(`${modalUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modalToken}`
      },
      body: JSON.stringify({
        gameId: String(gameId),
        videoUrl: String(videoUrl),
        config: req.body.config || {}
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("[ProcessGame] Modal API error", { 
        status: response.status, 
        error: errorText 
      });
      return res.status(500).json({ 
        error: "GPU Worker dispatch failed", 
        details: errorText 
      });
    }

    const result = await response.json();
    logger.info("[ProcessGame] GPU processing initiated successfully", { gameId });
    return res.status(200).json({ success: true, message: "GPU processing initiated", result });
  } catch (error: any) {
    logger.error("[ProcessGame] Error", error);
    return res.status(500).json({ error: error.message });
  }
}