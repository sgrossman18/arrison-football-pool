import { prisma } from "@/lib/db";
import { effectiveLockTime } from "@/lib/locking";
import { currentWeekExpiry } from "@/lib/timezone";

// One season per calendar year the NFL season starts in. Auto-creates the
// current year's season the first time anything needs it.
export async function getOrCreateCurrentSeason() {
  const year = new Date().getFullYear();
  let season = await prisma.season.findUnique({ where: { year } });
  if (!season) {
    season = await prisma.season.create({ data: { year } });
  }
  return season;
}

export async function getSeasonWeeks() {
  const season = await getOrCreateCurrentSeason();
  return prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "asc" },
    include: { games: { orderBy: [{ sortOrder: "asc" }, { kickoff: "asc" }] }, lockOverrides: true },
  });
}

// "Current" week = the one people should be looking at right now: the earliest
// week with games that hasn't passed its expiry yet — 7 PM Eastern on the
// Tuesday after its deadline (see currentWeekExpiry), so a week stays up
// through the weekend's games and early-week results instead of flipping to
// the next one the moment picks lock. If every week with games has expired,
// the most recent of those. A newly created week with no games yet is
// skipped so it can't hide the active one; only if nothing has games at all
// do we fall back to the latest week.
export function pickCurrentWeek<
  W extends { locksAt: Date | null; games: { kickoff: Date }[] },
>(weeks: W[], now: Date = new Date()): W | null {
  const withGames = weeks.filter((w) => w.games.length > 0);
  const active = withGames.find((w) => {
    const lock = effectiveLockTime({
      locksAt: w.locksAt,
      gameKickoffs: w.games.map((g) => g.kickoff),
    });
    return !lock || now < currentWeekExpiry(lock);
  });
  return active ?? withGames[withGames.length - 1] ?? weeks[weeks.length - 1] ?? null;
}

export async function getCurrentWeek() {
  return pickCurrentWeek(await getSeasonWeeks());
}
