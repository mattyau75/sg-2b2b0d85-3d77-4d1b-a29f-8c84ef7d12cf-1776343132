import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gameId } = req.body;

    // 1. Get Game Data to resolve video path
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) throw new Error("Game not found");

    // 2. Resolve Video URL (Same logic as UI)
    let videoUrl = game.video_path;
    if (videoUrl && !videoUrl.startsWith('http')) {
      const r2Base = process.env.NEXT_PUBLIC_R2_ENDPOINT?.replace(/\/$/, '');
      const bucket = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'videos';
      videoUrl = `${r2Base}/${bucket}/${videoUrl}`;
    }

    console.log(`[Process] Dispatching GPU Worker for Game: ${gameId} with Video: ${videoUrl}`);

    // 3. Trigger Modal GPU Worker
    const modalRes = await axios.post("https://basketball-scout-ai-analyze.modal.run", {
      game_id: gameId,
      video_url: videoUrl
    });

    return res.status(200).json({ 
      message: "GPU processing initiated",
      gameId: game.id
    });

  } catch (error: any) {
    console.error("[ProcessGame] Error:", error.message);
    return res.status(500).json({ 
      error: "Failed to initiate GPU processing",
      details: error.message 
    });
  }
}