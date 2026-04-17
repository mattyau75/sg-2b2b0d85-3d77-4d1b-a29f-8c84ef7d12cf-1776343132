import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const envCheck = {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    };

    // TEST: Try a REAL database query
    const { data, error, status } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    return res.status(200).json({
      status: "ok",
      envCheck,
      databaseResponse: {
        httpStatus: status,
        hasError: !!error,
        errorMessage: error?.message,
        errorDetails: error?.details,
        errorCode: error?.code
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      status: "error",
      error: err.message,
    });
  }
}