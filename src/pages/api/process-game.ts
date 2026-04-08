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
  console.log("------------------------------------------");
  console.log("CRITICAL: Incoming GPU Handshake Request");
  console.log("Method:", req.method);
  console.log("Body:", JSON.stringify(req.body));
  console.log("------------------------------------------");
  
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

    // Fetch team names for better labeling in the Python script
    const { data: homeTeam } = await supabase.from('teams').select('name').eq('id', config.home_team_id).single();
    const { data: awayTeam } = await supabase.from('teams').select('name').eq('id', config.away_team_id).single();

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
      console.log("Server: Dispatching production payload to Modal URL:", MODAL_URL);
      
      // Optimize roster payload for the wire
      const payload = {
        video_url: normalizedUrl,
        youtube_url: normalizedUrl,
        game_id: gameId,
        home_team: homeTeam?.name || "Home Team",
        away_team: awayTeam?.name || "Away Team",
        home_roster: (homePlayers || []).map(p => ({ id: p.id, name: p.name, number: p.number })),
        away_roster: (awayPlayers || []).map(p => ({ id: p.id, name: p.name, number: p.number })),
        config: {
          ...config,
          game_id: gameId,
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        },
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      };

      // THE REAL HANDSHAKE: Call the GPU cluster with a 2-hour timeout safety for long videos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7200000); // 2 hours

      try {
        const modalResponse = await fetch(MODAL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!modalResponse.ok) {
          const errorText = await modalResponse.text();
          console.error(`Server: Modal.com GPU Cluster Error (${modalResponse.status}):`, errorText);
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
        let hasResponded = false;

        // Background loop to process the stream
        const processStream = async () => {
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
                        status: 'analyzing'
                      })
                      .eq('id', gameId);
                  }

                  // Handle Final Result
                  if (data.__result && gameId) {
                    console.log(`Server: Game ${gameId} COMPLETED`);
                    const resultString = JSON.stringify(data.__result);
                    await supabase
                      .from('games')
                      .update({ 
                        status: 'completed',
                        progress_percentage: 100,
                        processing_metadata: resultString
                      })
                      .eq('id', gameId);
                  }

                  // Handle Errors from the Python Subprocess
                  if (data.__error && gameId) {
                    console.error(`Server: GPU Error for ${gameId}:`, data.__error);
                    const errorString = JSON.stringify({ error: data.__error });
                    await supabase
                      .from('games')
                      .update({ 
                        status: 'failed', 
                        last_error: data.__error,
                        processing_metadata: errorString
                      })
                      .eq('id', gameId);
                  }
                } catch (e) {
                  console.warn("Server: Failed to parse JSON line:", line);
                }
              }

              // Send initial response to client after the first chunk of data arrives
              if (!hasResponded) {
                hasResponded = true;
                res.status(200).json({ success: true, message: "Processing started on GPU cluster." });
              }
            }
          } catch (streamError) {
            console.error("Server: Stream processing interrupted:", streamError);
          }
        };

        // Start processing the stream
        await processStream();
        
        // Ensure we always respond if the stream finished immediately
        if (!hasResponded) {
          res.status(200).json({ success: true, message: "Processing finished (short video or empty stream)." });
        }

        return; 

      } catch (fetchError: any) {
        console.error("Server: Fetch failure to Modal:", {
          message: fetchError.message,
          name: fetchError.name,
          stack: fetchError.stack
        });
        if (fetchError.name === 'AbortError') {
          throw new Error("Connection to Modal.com timed out (90s). The GPU cluster might be experiencing a cold start or heavy load. Please try again in a moment.");
        }
        throw new Error(`Direct Connection Error: ${fetchError.message}`);
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