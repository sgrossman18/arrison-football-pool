import { prisma } from "@/lib/db";
import { isWeekLocked } from "@/lib/locking";

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
    include: { games: { orderBy: { kickoff: "asc" } }, lockOverrides: true },
  });
}

// "Current" week = the one people should be picking right now: the earliest
// week that has games and hasn't hit its deadline yet. If every week with
// games is already locked, the most recent of those. A newly created week
// with no games yet is skipped so it can't hide the week that's still open;
// only if nothing has games at all do we fall back to the latest week.
export function pickCurrentWeek<
  W extends { locksAt: Date | null; games: { kickoff: Date }[] },
>(weeks: W[]): W | null {
  const withGames = weeks.filter((w) => w.games.length > 0);
  const open = withGames.find((w) => !isWeekLocked({
    locksAt: w.locksAt,
    gameKickoffs: w.games.map((g) => g.kickoff),
  }));
  return open ?? withGames[withGames.length - 1] ?? weeks[weeks.length - 1] ?? null;
}

export async function getCurrentWeek() {
  return pickCurrentWeek(await getSeasonWeeks());
}
