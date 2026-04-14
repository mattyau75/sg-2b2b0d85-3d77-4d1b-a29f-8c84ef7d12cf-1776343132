import { NextApiRequest, NextApiResponse } from "next";
import { s3Client } from "@/lib/s3Client";
import { r2Client } from "@/lib/r2Client";
import { ListBucketsCommand } from "@aws-sdk/client-s3";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const report: any = {
    timestamp: new Date().toISOString(),
    supabase: { status: "checking" },
    r2: { status: "checking" }
  };

  try {
    const supabaseTest = await s3Client.send(new ListBucketsCommand({}));
    report.supabase = { status: "connected", buckets: supabaseTest.Buckets?.length };
  } catch (err: any) {
    report.supabase = { status: "failed", error: err.message, code: err.code, endpoint: process.env.NEXT_PUBLIC_SUPABASE_URL };
  }

  try {
    const r2Test = await r2Client.send(new ListBucketsCommand({}));
    report.r2 = { status: "connected", buckets: r2Test.Buckets?.length };
  } catch (err: any) {
    report.r2 = { status: "failed", error: err.message, code: err.code, env_present: !!process.env.R2_ENDPOINT };
  }

  return res.status(200).json(report);
}