import { NextRequest, NextResponse } from "next/server";
import { syncAllActiveWeeks } from "@/lib/sync-scores";

// Vercel Cron (configured in vercel.json) hits this on a schedule to keep
// scores/grading up to date without anyone needing to refresh anything.
// Protected by CRON_SECRET so randoms can't trigger it.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncAllActiveWeeks();
  return NextResponse.json(result);
}
