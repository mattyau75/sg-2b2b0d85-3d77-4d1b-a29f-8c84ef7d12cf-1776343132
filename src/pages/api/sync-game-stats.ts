import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Object.keys(req.cookies).map((name) => ({
              name,
              value: req.cookies[name] || '',
            }));
          },
          setAll(cookiesToSet) {
            try {
              const setCookieHeaders = cookiesToSet.map(({ name, value, options }) =>
                serialize(name, value, options)
              );
              if (setCookieHeaders.length > 0) {
                res.setHeader('Set-Cookie', setCookieHeaders);
              }
            } catch (error) {
              // Ignore if headers already sent
            }
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { gameId, stats } = req.body;

    if (!gameId || !stats) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data, error } = await supabase
      .from("games")
      .update({ 
        stats,
        updated_at: new Date().toISOString()
      })
      .eq("id", gameId)
      .select()
      .single();

    if (error) {
      console.error("Sync stats error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ error: error.message });
  }
}