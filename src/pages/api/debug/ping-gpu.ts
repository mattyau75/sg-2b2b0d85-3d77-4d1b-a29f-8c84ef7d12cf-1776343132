import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const { test_id } = req.body;
  const modalProjectName = "basketball-scout-ai"; // From modal_worker.py app definition

  try {
    // 🛡️ DYNAMIC MODAL URL RESOLUTION
    // The label is "ping", and app name is "basketball-scout-ai"
    const modalUrl = `https://softgen--${modalProjectName}-ping.modal.run`;

    console.log(`📡 Dispatching Pulse to: ${modalUrl}`);
    
    const response = await axios.post(modalUrl, {
      test_id: test_id || `test-${Date.now()}`
    }, {
      timeout: 10000 // 10s timeout for the handshake signal
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Pulse Dispatch Error:", error.response?.data || error.message);
    return res.status(500).json({ 
      status: "error", 
      message: error.response?.data?.message || error.message 
    });
  }
}