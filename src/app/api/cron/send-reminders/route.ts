import { NextRequest, NextResponse } from "next/server";
import { getCurrentWeek } from "@/lib/season";
import { nextUpcomingLock } from "@/lib/locking";
import { sendRemindersForWeek } from "@/lib/reminders";

// Vercel Cron hits this daily at 13:00 UTC (9 AM Eastern during daylight
// time, 8 AM once clocks fall back). Only nudges for the current week while
// its next lock (the soonest game deadline still ahead) is within the next 36
// hours, so a week set up far in advance doesn't get reminders early — and a
// Thanksgiving-style week gets one before its Thursday games lock.
// Unlike the score-sync cron this one emails real people, so it refuses to
// run at all unless CRON_SECRET is configured. Add ?dryRun=1 to see who
// would be emailed without sending anything.
export const maxDuration = 60;

const WINDOW_MS = 36 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const week = await getCurrentWeek();
  if (!week) return NextResponse.json({ skipped: "no weeks" });

  const lock = nextUpcomingLock(week.games, {
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  });
  const msUntilLock = lock ? lock.getTime() - Date.now() : null;
  if (msUntilLock === null || msUntilLock > WINDOW_MS) {
    return NextResponse.json({ skipped: "no pick deadline within the next 36 hours", weekNumber: week.weekNumber });
  }

  const result = await sendRemindersForWeek(week.id, { dryRun });
  return NextResponse.json({ weekNumber: week.weekNumber, dryRun, ...result });
}
