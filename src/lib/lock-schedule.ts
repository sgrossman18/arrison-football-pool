import { utcToEasternDateOnly } from "@/lib/timezone";

// Works out each game's own lock time from its real start time. Games that
// start on a Sunday or Monday lock with the week's main deadline (null), the
// pool's usual rule. Games on any other day (Thanksgiving Thursday, Friday
// Christmas games, Saturday games) are grouped by Eastern calendar day, and
// each group locks together at the first kickoff of that day — so three
// Thanksgiving games lock before the first one starts, and the Friday game
// locks at its own kickoff.
export function computeGameLocks(
  games: { id: string; start: Date | null }[],
): Map<string, Date | null> {
  const firstStartByDay = new Map<string, Date>();
  const dayOf = new Map<string, string>();

  for (const g of games) {
    if (!g.start) continue;
    const day = utcToEasternDateOnly(g.start);
    dayOf.set(g.id, day);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 1) continue;
    const first = firstStartByDay.get(day);
    if (!first || g.start < first) firstStartByDay.set(day, g.start);
  }

  const locks = new Map<string, Date | null>();
  for (const g of games) {
    if (!g.start) continue;
    locks.set(g.id, firstStartByDay.get(dayOf.get(g.id)!) ?? null);
  }
  return locks;
}
