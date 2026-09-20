import { NextRequest, NextResponse } from "next/server";
import { getCurrentWeek } from "@/lib/season";
import { effectiveLockTime } from "@/lib/locking";
import { sendRemindersForWeek } from "@/lib/reminders";

// Vercel Cron hits this Saturday and Sunday at 13:00 UTC (9 AM Eastern during
// daylight time, 8 AM once clocks fall back). Only nudges for the latest week
// while it's still open and its deadline is within the next 36 hours, so a
// week set up far in advance doesn't get reminders early.
// Unlike the score-sync cron this one emails real people, so it refuses to
// run at all unless CRON_SECRET is configured. Add ?dryRun=1 to see who
// would be emailed without sending anything.
const WINDOW_MS = 36 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const week = await getCurrentWeek();
  if (!week) return NextResponse.json({ skipped: "no weeks" });

  const lock = effectiveLockTime({
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  });
  const msUntilLock = lock ? lock.getTime() - Date.now() : null;
  if (msUntilLock === null || msUntilLock <= 0 || msUntilLock > WINDOW_MS) {
    return NextResponse.json({ skipped: "deadline not within the next 36 hours", weekNumber: week.weekNumber });
  }

  const result = await sendRemindersForWeek(week.id, { dryRun });
  return NextResponse.json({ weekNumber: week.weekNumber, dryRun, ...result });
}
