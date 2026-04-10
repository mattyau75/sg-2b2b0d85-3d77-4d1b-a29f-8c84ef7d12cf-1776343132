import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import { r2Client } from "@/lib/r2Client";
import { modalService } from "@/services/modalService";
import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const { gameId, videoPath, homeTeamId, awayTeamId, homeColor, awayColor } = req.body;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!bucketName) throw new Error("R2_BUCKET_NAME environment variable is missing");
    const sanitizedPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
    
    try {
      await r2Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: sanitizedPath }));
    } catch (e: any) {
      return res.status(404).json({ message: "Video file not found in storage", path: sanitizedPath });
    }

    const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: sanitizedPath });
    const signedUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 86400 });

    const [{ data: homeRoster }, { data: awayRoster }] = await Promise.all([
      supabase.from('players').select('id, name, number').eq('team_id', homeTeamId),
      supabase.from('players').select('id, name, number').eq('team_id', awayTeamId)
    ]);

    const gpuConfig = {
      game_id: gameId, 
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      homeColor,
      awayColor,
      home_roster: homeRoster || [],
      away_roster: awayRoster || [],
      scouting_mode: "deep_recognition",
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    };

    await supabase.from('games').update({ status: 'analyzing', progress_percentage: 25, ignition_status: 'ignited', updated_at: new Date().toISOString() }).eq('id', gameId);

    modalService.processGame(signedUrl, { game_id: gameId, ...gpuConfig }).catch(err => {
      console.error("[ProcessGame] GPU Handoff Failed:", err.message);
      supabase.from('games').update({ status: 'error', last_error: `GPU Connection Failed: ${err.message}`, ignition_status: 'failed' }).eq('id', gameId);
    });

    return res.status(202).json({ success: true, message: "Ignition Sequence Started", id: gameId });
  } catch (error: any) {
    console.error("[ProcessGame] Crash:", error.message);
    return res.status(500).json({ message: error.message });
  }
}