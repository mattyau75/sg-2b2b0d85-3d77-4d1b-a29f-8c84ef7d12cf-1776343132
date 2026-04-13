import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/integrations/supabase/client';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { gameId, metadata } = req.body;
  const modalUser = process.env.NEXT_PUBLIC_MODAL_USER_NAME || "mattjeffs";
  const MODAL_ENDPOINT = `https://${modalUser}--basketball-scout-ai-analyze.modal.run`;

  try {
    // 1. VERIFY VIDEO SOURCE & GENERATE 3-HOUR TOKEN
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('video_path, id')
      .eq('id', gameId)
      .single();

    if (gameError || !game?.video_path) {
      return res.status(404).json({ success: false, message: "❌ R2 SOURCE MISSING: Cannot ignite GPU without video." });
    }

    const { data: signedUrl } = await supabase.storage
      .from('game-videos')
      .createSignedUrl(game.video_path, 10800); // 3-Hour High-Capacity Window

    // 2. ATOMIC HANDOVER TO MODAL.COM
    console.log(`📡 Handing off 1-hour footage to GPU: ${gameId}`);
    await axios.post(MODAL_ENDPOINT, {
      game_id: game.id,
      video_url: signedUrl?.signedUrl,
      metadata: metadata,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY // Only server-side has this
    });

    // 3. UPDATE DB STATUS
    await supabase.from('games').update({ processing_status: 'ignited' }).eq('id', game.id);

    return res.status(200).json({ success: true, message: "🚀 GPU Cluster Ignited. Streaming active." });
  } catch (error: any) {
    console.error("❌ Handshake Bridge Failure:", error.message);
    return res.status(500).json({ success: false, message: "System Bridge Disconnected. Check Modal Deployment." });
  }
}