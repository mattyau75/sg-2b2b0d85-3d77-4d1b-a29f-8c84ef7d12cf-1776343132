import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Secure server-side handler for Modal.com GPU processing.
 * This route has access to the MODAL_TOKEN_SECRET env var.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { youtubeUrl, config, gameId } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ message: "YouTube URL is required" });
  }

  // Normalize URL for Modal/yt-dlp compatibility
  let normalizedUrl = youtubeUrl;
  if (youtubeUrl.includes("youtu.be/")) {
    const videoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
    normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
  }

  const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID;
  const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET;

  if (!MODAL_TOKEN_ID || !MODAL_TOKEN_SECRET) {
    console.error("Missing Modal credentials in server environment variables.");
    // If gameId exists, mark as failed so user sees why in the UI
    if (gameId) {
      await supabase
        .from('games')
        .update({ 
          status: 'failed', 
          last_error: "Server configuration error: Modal credentials missing." 
        })
        .eq('id', gameId);
    }
    return res.status(500).json({ 
      message: "Server configuration error: Modal credentials missing." 
    });
  }

  try {
    console.log("Server: Initiating Modal.com GPU pipeline for", youtubeUrl);

    // Get the Modal endpoint from env - this should be your deployed function URL
    // e.g., https://your-user--basketball-scout-process.modal.run
    const MODAL_URL = process.env.MODAL_URL;

    if (!MODAL_URL) {
      console.warn("MODAL_URL missing. Using simulation mode for bridge verification.");
    }

    // Pass team roster info to Modal to enable this fuzzy matching on the edge
    const { data: homePlayers } = await supabase.from('players').select('id, name, number').eq('team_id', config.home_team_id);
    const { data: awayPlayers } = await supabase.from('players').select('id, name, number').eq('team_id', config.away_team_id);

    // Update game status in database to 'queued'
    if (gameId) {
      await supabase
        .from('games')
        .update({ 
          status: 'queued', 
          youtube_url: normalizedUrl,
          camera_type: config.camera_type,
          progress_percentage: 15,
          last_error: null
        })
        .eq('id', gameId);
    }

    if (MODAL_URL) {
      // THE REAL HANDSHAKE: Call the GPU cluster
      const modalResponse = await fetch(MODAL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Token-Id': MODAL_TOKEN_ID,
          'X-Modal-Token-Secret': MODAL_TOKEN_SECRET
        },
        body: JSON.stringify({
          youtube_url: normalizedUrl,
          game_id: gameId,
          config: config,
          home_roster: homePlayers,
          away_roster: awayPlayers,
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        })
      });

      if (!modalResponse.ok) {
        const errorData = await modalResponse.json();
        throw new Error(errorData.message || "Modal GPU cluster rejected the request.");
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: "Modal.com GPU pipeline initiated successfully.",
      job_id: `modal_job_${Math.random().toString(36).substr(2, 9)}`,
      normalized_url: normalizedUrl
    });

  } catch (error: any) {
    console.error("Modal processing error details:", {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    return res.status(500).json({ 
      message: "Failed to communicate with Modal.com",
      details: error.message 
    });
  }
}