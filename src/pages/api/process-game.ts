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

    if (gameError || !game) throw new Error("Game not found");

    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith('http')) {
      const r2Base = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, '');
      const bucket = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'videos';
      const cleanPath = videoUrl.startsWith(`${bucket}/`) ? videoUrl.replace(`${bucket}/`, '') : videoUrl;
      videoUrl = `${r2Base}/${bucket}/${cleanPath}`;
    }

    logger.info(`[Process] Dispatching GPU Worker`, { gameId, videoUrl });

    const response = await fetch(`${process.env.MODAL_USER_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MODAL_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        gameId: String(gameId),
        videoUrl: String(videoUrl),
        config: req.body.config || {}
      }),
    });

    if (!response.ok) throw new Error("GPU Worker dispatch failed");

    return res.status(200).json({ success: true, message: "GPU processing initiated" });
  } catch (error: any) {
    logger.error("[ProcessGame] Error", error);
    return res.status(500).json({ error: error.message });
  }
}