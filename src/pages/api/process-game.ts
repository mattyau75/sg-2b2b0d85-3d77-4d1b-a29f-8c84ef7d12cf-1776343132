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

  // youtubeUrl might be a YouTube link OR a Supabase Storage path
  let videoSourceUrl = youtubeUrl;

  // 1. If it's a storage path (doesn't start with http/www), generate a signed URL
  if (youtubeUrl && !youtubeUrl.startsWith('http') && !youtubeUrl.includes('youtube') && !youtubeUrl.includes('youtu.be')) {
    console.log("Server: Detected storage path, generating signed URL:", youtubeUrl);
    const { data, error: signedUrlError } = await supabase.storage
      .from('game-videos')
      .createSignedUrl(youtubeUrl, 7200); // 2 hours access

    if (signedUrlError || !data?.signedUrl) {
      console.error("Server: Failed to generate signed URL:", signedUrlError);
      return res.status(500).json({ message: "Failed to generate secure access to video file." });
    }
    videoSourceUrl = data.signedUrl;
  } else if (youtubeUrl && (youtubeUrl.includes("youtu.be/") || youtubeUrl.includes("youtube.com"))) {
    // Normalize YouTube URL for Modal/yt-dlp compatibility
    if (youtubeUrl.includes("youtu.be/")) {
      const videoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
      videoSourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
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
          youtube_url: youtubeUrl.includes('http') ? youtubeUrl : null,
          video_path: !youtubeUrl.includes('http') ? youtubeUrl : null,
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

    // START STREAMING HANDLER
    const reader = modalResponse.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error("Failed to open stream from Modal GPU");
    }

    // Buffer for JSON-lines
    let buffer = "";
    let finalResultReceived = false;
    let lastError: string | null = null;

    // Process the ENTIRE stream before responding to the client
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (!line.trim()) continue;
          console.log("Server: Received line from Modal:", line);
          
          try {
            const data = JSON.parse(line);
            
            // Handle Progress Updates
            if (data.__progress !== undefined && gameId) {
              const progress = Math.min(Math.round(data.__progress), 95);
              console.log(`Server: Game ${gameId} progress: ${progress}%`);
              await supabase
                .from('games')
                .update({ 
                  progress_percentage: progress,
                  status: 'analyzing',
                  updated_at: new Date().toISOString()
                })
                .eq('id', gameId);
            }

            // Handle Final Result
            if (data.__result && gameId) {
              console.log(`Server: Game ${gameId} COMPLETED - Saving result`);
              finalResultReceived = true;
              
              const { error: updateError } = await supabase
                .from('games')
                .update({ 
                  status: 'completed',
                  progress_percentage: 100,
                  processing_metadata: data.__result,
                  updated_at: new Date().toISOString()
                })
                .eq('id', gameId);
              
              if (updateError) {
                console.error("Server: Failed to save result:", updateError);
              } else {
                console.log("Server: Result saved successfully");
              }
              
              // Trigger stats sync
              try {
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync-game-stats`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameId })
                });
              } catch (syncErr) {
                console.error("Server: Failed to trigger stats sync:", syncErr);
              }
            }

            // Handle Errors from the Python Subprocess
            if (data.__error && gameId) {
              console.error(`Server: GPU Error for ${gameId}:`, data.__error);
              finalResultReceived = true;
              lastError = data.__error;
              
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
          } catch (parseError) {
            console.warn("Server: Failed to parse JSON line:", line, parseError);
          }
        }
      }

      // Cleanup: If stream ended but no result was saved
      if (!finalResultReceived && gameId) {
        console.warn(`Server: Stream ended for ${gameId} without result or error.`);
        await supabase
          .from('games')
          .update({ 
            status: 'failed', 
            last_error: "Video processing interrupted (Stream ended without result).",
            updated_at: new Date().toISOString()
          })
          .eq('id', gameId);
        
        return res.status(500).json({ 
          message: "Processing incomplete - stream ended unexpectedly." 
        });
      }

      // Success - Stream completed and result was saved
      if (lastError) {
        return res.status(500).json({ 
          message: `Processing failed: ${lastError}` 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Processing completed successfully.",
        gameId 
      });

    } catch (streamError) {
      console.error("Server: Stream processing error:", streamError);
      await supabase
        .from('games')
        .update({ 
          status: 'failed', 
          last_error: `Stream error: ${streamError}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', gameId);
      
      return res.status(500).json({ 
        message: `Stream processing failed: ${streamError}` 
      });
    }
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}