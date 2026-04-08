import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { storageService } from "@/services/storageService";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { youtubeUrl, config, gameId } = req.body;

  let videoSourceUrl = youtubeUrl;

  // R2 Storage Path Detection
  if (youtubeUrl && !youtubeUrl.startsWith("http") && !youtubeUrl.includes("youtube") && !youtubeUrl.includes("youtu.be")) {
    try {
      const bucketName = process.env.R2_BUCKET_NAME || "dribbleai-softgen";
      const signedUrl = await storageService.getSignedUrl(youtubeUrl);
      videoSourceUrl = signedUrl;
    } catch (err) {
      console.error("R2 Signing Error:", err);
      return res.status(500).json({ message: "Failed to secure access to R2 video file." });
    }
  }

  const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID;
  const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET;
  const MODAL_URL = process.env.MODAL_URL;

  if (!MODAL_TOKEN_ID || !MODAL_TOKEN_SECRET) {
    if (gameId) {
      await supabase
        .from("games")
        .update({ status: "failed", last_error: "Modal credentials missing." })
        .eq("id", gameId);
    }
    return res.status(500).json({ message: "Server configuration error: Modal credentials missing." });
  }

  try {
    const { data: homePlayers } = await supabase.from("players").select("id, name, number").eq("team_id", config.home_team_id);
    const { data: awayPlayers } = await supabase.from("players").select("id, name, number").eq("team_id", config.away_team_id);
    const { data: homeTeam } = await supabase.from("teams").select("name").eq("id", config.home_team_id).single();
    const { data: awayTeam } = await supabase.from("teams").select("name").eq("id", config.away_team_id).single();

    if (gameId) {
      await supabase
        .from("games")
        .update({ 
          status: "queued", 
          youtube_url: null,
          video_path: youtubeUrl,
          camera_type: config.camera_type,
          progress_percentage: 15,
          last_error: null
        })
        .eq("id", gameId);
    }

    if (!MODAL_URL) {
      return res.status(200).json({ success: true, message: "Simulation mode: MODAL_URL not set." });
    }

    const payload = {
      video_url: videoSourceUrl,
      game_id: gameId,
      home_team: homeTeam?.name || "Home Team",
      away_team: awayTeam?.name || "Away Team",
      home_roster: (homePlayers || []).map(p => ({ id: p.id, name: p.name, number: p.number })),
      away_roster: (awayPlayers || []).map(p => ({ id: p.id, name: p.name, number: p.number })),
      config: {
        ...config,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    };

    const modalResponse = await fetch(MODAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      return res.status(modalResponse.status).json({ message: `Modal Error: ${errorText.slice(0, 100)}` });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Analysis swarm launched.",
      gameId 
    });

  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}