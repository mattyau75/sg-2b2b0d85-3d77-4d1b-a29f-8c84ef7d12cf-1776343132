import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🛡️ SECURITY HANDSHAKE: Align with specific auth-helpers v0.15 signature
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

    if (!session) {
      return res.status(401).json({ error: "Unauthorized access blocked." });
    }

    const { gameId } = req.body;

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

    const sanitizedPayload = {
      gameId: String(gameId).replace(/[^a-zA-Z0-9-]/g, ""),
      videoUrl: String(videoUrl),
      config: typeof req.body.config === 'object' ? req.body.config : {}
    };

    const response = await fetch(`${process.env.MODAL_USER_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MODAL_AUTH_TOKEN}`
      },
      body: JSON.stringify(sanitizedPayload),
    });

    if (!response.ok) {
        throw new Error("Worker dispatch failed");
    }

    return res.status(200).json({ 
      message: "GPU processing initiated",
      gameId: game.id
    });

  } catch (error: any) {
    logger.error("[ProcessGame] Error", error);
    return res.status(500).json({ error: error.message });
  }
}