import { prisma } from "@/lib/db";

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

// "Current" week = the highest week number the admin has set up so far.
// Whoever is running the pool creates one week at a time, so the latest one
// is naturally the active one.
export async function getCurrentWeek() {
  const season = await getOrCreateCurrentSeason();
  return prisma.week.findFirst({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "desc" },
    include: { games: { orderBy: { kickoff: "asc" } }, lockOverrides: true },
  });
}
