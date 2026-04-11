import { supabase } from "@/integrations/supabase/client";

export async function simulateAnalysis(gameId: string) {
  const steps = [
    { progress: 10, message: "Initializing Local Mock Swarm...", level: "info" },
    { progress: 25, message: "Calibrating team colors (Local Simulation)...", level: "info" },
    { progress: 40, message: "Heartbeat: Cluster active (Simulated)", level: "heartbeat" },
    { progress: 60, message: "Detecting personnel via Mock OCR...", level: "info" },
    { progress: 85, message: "Mapping players to rosters...", level: "info" },
    { progress: 100, message: "Discovery complete.", level: "info" }
  ];

  const currentLogs: any[] = [];

  for (const step of steps) {
    // Wait for simulation realism
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newLog = {
      timestamp: new Date().toISOString(),
      message: step.message,
      level: step.level
    };
    currentLogs.push(newLog);

    await supabase.from("games").update({
      progress_percentage: step.progress,
      status: step.progress === 100 ? "completed" : "analyzing",
      processing_metadata: {
        worker_logs: currentLogs,
        last_heartbeat: new Date().toISOString(),
        is_mock: true
      }
    } as any).eq("id", gameId);
  }
}