import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gameId } = req.body;

    // 1. GET GAME METADATA
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) throw new Error("Game not found");

    // 2. GENERATE SUPABASE STORAGE SIGNED URL (24-hour expiry for GPU processing)
    console.log(`[ProcessGame] Generating Supabase Storage signed URL for: ${game.video_path}`);
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from('videos')
      .createSignedUrl(game.video_path, 86400); // 24 hours

    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Failed to generate video access URL: ${urlError?.message}`);
    }

    const authorizedVideoUrl = urlData.signedUrl;
    console.log(`[ProcessGame] Supabase signed URL generated successfully`);

    // 3. PREPARE GPU PAYLOAD
    const metadata = {
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      home_team_color: game.home_team_color,
      away_team_color: game.away_team_color,
      venue_id: game.venue_id,
      date: game.date
    };

    // 4. TRIGGER MODAL.COM GPU WORKER
    const modalUser = process.env.NEXT_PUBLIC_MODAL_USER_NAME || "mattjeffs";
    const MODAL_ENDPOINT = `https://${modalUser}--basketball-scout-ai-analyze.modal.run`;

    console.log(`[ProcessGame] Triggering GPU analysis for game: ${gameId}`);
    
    await axios.post(MODAL_ENDPOINT, {
      game_id: game.id,
      video_url: authorizedVideoUrl,
      metadata: metadata,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY
    }, {
      timeout: 10000
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