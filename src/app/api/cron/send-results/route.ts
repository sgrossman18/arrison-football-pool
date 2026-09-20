import { NextRequest, NextResponse } from "next/server";
import { getSeasonWeeks } from "@/lib/season";
import { effectiveLockTime } from "@/lib/locking";
import { syncAllActiveWeeks } from "@/lib/sync-scores";
import { sendResultsEmailForWeek } from "@/lib/results-email";

export const maxDuration = 60;

// Tuesday-morning results + standings email. Refreshes scores first, then
// emails the most recent week that (a) has every game final, (b) locked within
// the last 4 days — so weeks that ended long ago are never emailed
// retroactively — and (c) hasn't been emailed yet. The "already sent" stamp on
// the week makes it safe for the scheduler to call this more than once.
// Refuses to run without CRON_SECRET since it emails real people.
// ?dryRun=1 returns the recipients and rendered email without sending;
// ?week=N (testing) previews a specific week regardless of the rules above.
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const weekOverride = req.nextUrl.searchParams.get("week");

  const sync = await syncAllActiveWeeks();
  const weeks = await getSeasonWeeks();

  let target;
  if (weekOverride) {
    if (!dryRun) return NextResponse.json({ error: "?week= is only allowed with ?dryRun=1" }, { status: 400 });
    target = weeks.find((w) => String(w.weekNumber) === weekOverride);
  } else {
    const now = Date.now();
    target = [...weeks].reverse().find((w) => {
      if (w.games.length === 0 || w.resultsEmailSentAt) return false;
      if (!w.games.every((g) => g.status === "FINAL")) return false;
      const lock = effectiveLockTime({ locksAt: w.locksAt, gameKickoffs: w.games.map((g) => g.kickoff) });
      return !!lock && now >= lock.getTime() && now - lock.getTime() <= MAX_AGE_MS;
    });
  }
  if (!target) return NextResponse.json({ skipped: "no week is ready to email", sync });

  const result = await sendResultsEmailForWeek(target.id, { dryRun });
  return NextResponse.json({ weekNumber: target.weekNumber, dryRun, sync, ...result });
}
