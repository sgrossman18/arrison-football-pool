import { prisma } from "@/lib/db";
import { fetchWeekScoreboard } from "@/lib/espn";
import { isWeekLocked } from "@/lib/locking";

// Opportunistic freshness: results/standings pages call this before
// rendering so scores update the moment someone actually looks, without
// waiting on a cron. Throttled per server instance so a page full of
// visitors doesn't hammer ESPN — Vercel Cron (see vercel.json) is the
// backstop for when nobody's looking.
let lastSyncAt = 0;
const MIN_SYNC_INTERVAL_MS = 20_000;

export async function maybeSyncActiveWeeks() {
  const now = Date.now();
  if (now - lastSyncAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncAt = now;
  try {
    await syncAllActiveWeeks();
  } catch {
    // Best-effort — a failed opportunistic sync shouldn't break page loads.
  }
}

// Pulls live scores for every week that still has an unfinished game and
// updates our Game rows. Safe to call repeatedly (e.g. from a cron route) —
// it's a no-op once every game in a week is FINAL.
export async function syncAllActiveWeeks() {
  const weeks = await prisma.week.findMany({
    where: { games: { some: { status: { not: "FINAL" } } } },
    include: { games: true, season: true },
  });

  let updated = 0;
  const errors: string[] = [];

  for (const week of weeks) {
    // No point polling ESPN before picks have even locked — games don't
    // track individual kickoff times anymore (the whole week shares one
    // deadline), so the deadline itself is the "has this week started" signal.
    const started = isWeekLocked({
      locksAt: week.locksAt,
      gameKickoffs: week.games.map((g) => g.kickoff),
    });
    if (!started) continue;

    try {
      const espnGames = await fetchWeekScoreboard(week.season.year, week.weekNumber);

      for (const game of week.games) {
        const match = espnGames.find(
          (e) =>
            (e.homeTeam === game.homeTeam && e.awayTeam === game.awayTeam) ||
            (e.homeTeam === game.awayTeam && e.awayTeam === game.homeTeam),
        );
        if (!match) continue;

        // Normalize in case ESPN's home/away differs from ours (shouldn't
        // for NFL, but be defensive).
        const homeScore = match.homeTeam === game.homeTeam ? match.homeScore : match.awayScore;
        const awayScore = match.homeTeam === game.homeTeam ? match.awayScore : match.homeScore;

        if (
          game.status !== match.status ||
          game.homeScore !== homeScore ||
          game.awayScore !== awayScore
        ) {
          await prisma.game.update({
            where: { id: game.id },
            data: {
              status: match.status,
              homeScore,
              awayScore,
              espnEventId: match.espnEventId,
            },
          });
          updated += 1;
        }
      }
    } catch (err) {
      errors.push(`Week ${week.weekNumber}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { updated, errors };
}
