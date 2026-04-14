import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const scriptPath = path.join(process.cwd(), "deploy_modal.sh");
    
    // Ensure script is executable
    if (fs.existsSync(scriptPath)) {
      fs.chmodSync(scriptPath, "755");
    }

    console.log("[Deploy] Executing Modal deployment...");
    
    exec("sh deploy_modal.sh", (error, stdout, stderr) => {
      if (error) {
        console.error(`[Deploy Error] ${error.message}`);
        return;
      }
      console.log(`[Deploy Success] ${stdout}`);
    });

    return res.status(200).json({ 
      message: "Deployment triggered. This runs in the background. Check Modal dashboard in 60s." 
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}