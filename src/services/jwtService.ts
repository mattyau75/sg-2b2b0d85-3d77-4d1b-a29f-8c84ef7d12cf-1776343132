import jwt from "jsonwebtoken";

/**
 * Generates a short-lived, scoped JWT for the GPU Worker.
 * This token allows the GPU to update ONLY the specific game it is processing.
 */
export function generateGpuToken(gameId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for JWT generation.");

  const payload = {
    role: "service_role",
    iss: "supabase",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    game_id: gameId,
    purpose: "gpu_analysis_telemetry"
  };

  return jwt.sign(payload, secret);
}