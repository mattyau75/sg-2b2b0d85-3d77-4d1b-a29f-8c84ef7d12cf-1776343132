import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Secure server-side handler for Modal.com GPU processing.
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
  const MODAL_URL = process.env.MODAL_URL;

  if (!MODAL_TOKEN_ID || !MODAL_TOKEN_SECRET) {
    if (gameId) {
      await supabase
        .from('games')
        .update({ status: 'failed', last_error: "Modal credentials missing." })
        .eq('id', gameId);
    }
    return res.status(500).json({ message: "Server configuration error: Modal credentials missing." });
  }

  try {
    // Fetch context for the GPU worker
    const { data: homePlayers } = await supabase.from('players').select('id, name, number').eq('team_id', config.home_team_id);
    const { data: awayPlayers } = await supabase.from('players').select('id, name, number').eq('team_id', config.away_team_id);
    const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', config.home_team_id).single();
    const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', config.away_team_id).single();

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

    if (!MODAL_URL) {
      return res.status(200).json({ success: true, message: "Simulation mode: MODAL_URL not set." });
    }

    const payload = {
      video_url: normalizedUrl,
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7200000); // 2h

    const modalResponse = await fetch(MODAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!modalResponse.ok) {
      const errorText = await modalResponse.text();
      return res.status(modalResponse.status).json({ message: `Modal Error: ${errorText.slice(0, 100)}` });
    }

    const reader = modalResponse.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) throw new Error("Failed to open stream from Modal GPU");

    // Important: Respond to the client so the UI doesn't hang waiting for the stream
    res.status(200).json({ success: true, message: "Handshake successful. Analysis started." });

    let buffer = "";
    let finalResultReceived = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.__progress !== undefined && gameId) {
              await supabase
                .from('games')
                .update({ 
                  progress_percentage: Math.min(Math.round(data.__progress), 95),
                  status: 'analyzing',
                  updated_at: new Date().toISOString()
                })
                .eq('id', gameId);
            }

            if (data.__result && gameId) {
              finalResultReceived = true;
              await supabase
                .from('games')
                .update({ 
                  status: 'completed',
                  progress_percentage: 100,
                  processing_metadata: data.__result, // Directly as object for JSONB
                  updated_at: new Date().toISOString()
                })
                .eq('id', gameId);
              
              // Trigger auto-sync
              await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/sync-game-stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId })
              }).catch(e => console.error("Sync trigger failed", e));
            }

            if (data.__error && gameId) {
              finalResultReceived = true;
              await supabase
                .from('games')
                .update({ 
                  status: 'failed', 
                  last_error: data.__error,
                  processing_metadata: { error: data.__error },
                  updated_at: new Date().toISOString()
                })
                .eq('id', gameId);
            }
          } catch (e) {
            console.warn("Stream parse error", e);
          }
        }
      }

      if (!finalResultReceived && gameId) {
        await supabase
          .from('games')
          .update({ 
            status: 'failed', 
            last_error: "Stream ended without result payload.",
            updated_at: new Date().toISOString()
          })
          .eq('id', gameId);
      }
    } catch (streamError) {
      console.error("Stream processing loop error", streamError);
    }
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}