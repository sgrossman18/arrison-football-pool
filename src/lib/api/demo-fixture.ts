import type { Game, Season } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEMO_FAKE_DOMAIN, DEMO_SEASON_YEAR } from "@/lib/demo";

// Builds (once) and keeps fresh the App Review fixture season:
//  - Weeks 1–4: finished. Week 3 has 6 games (an undroppable ★ week), so the
//    standings show drops, ties-by-chance, and a ★.
//  - Week 5 ("this week"): staged locks. Game 1 is already locked and FINAL, so a
//    reviewer who skips it sees the burned-number banner; game 2 locks tomorrow;
//    the rest lock in 3 days. Lock times are re-based on "now" so the week never
//    expires, however long after creation the review happens.
// Everything is deterministic — no randomness — and idempotent.

type Pair = [away: string, home: string];

const HISTORY: Pair[][] = [
  [["BUF", "MIA"], ["DAL", "NYG"], ["KC", "DEN"], ["SF", "LAR"], ["GB", "CHI"]],
  [["PHI", "WSH"], ["DET", "MIN"], ["BAL", "CIN"], ["HOU", "IND"], ["SEA", "ARI"]],
  [["KC", "BUF"], ["DAL", "DET"], ["GB", "PHI"], ["SF", "SEA"], ["PIT", "BAL"], ["MIA", "NYJ"]],
  [["LAC", "LV"], ["TB", "NO"], ["ATL", "CAR"], ["JAX", "TEN"], ["NE", "CLE"]],
];
const CURRENT: Pair[] = [["DAL", "PHI"], ["BUF", "KC"], ["GB", "DET"], ["SF", "SEA"], ["PIT", "CLE"]];
const CURRENT_WEEK = HISTORY.length + 1;

const FAKE_PLAYERS = ["Dad", "Mom", "Casey"];

const DAY = 86_400_000;
const HOUR = 3_600_000;

function scores(weekIdx: number, i: number): { home: number; away: number } {
  const home = 14 + ((weekIdx * 7 + i * 5) % 17);
  let away = 10 + ((weekIdx * 3 + i * 11) % 19);
  if (away === home) away += 1;
  return { home, away };
}

// A unique 1..n confidence for each game, rotated per player and week.
function picksFor(playerIdx: number, weekIdx: number, games: Pair[]) {
  const n = games.length;
  const shift = (playerIdx * 2 + weekIdx) % n;
  return games.map(([away, home], i) => ({
    team: (i + playerIdx + weekIdx) % 3 === 0 ? away : home,
    confidence: ((i + shift) % n) + 1,
  }));
}

async function ensureSeasonAndPlayers(): Promise<{ season: Season; playerIds: string[] }> {
  const season = await prisma.season.upsert({
    where: { year: DEMO_SEASON_YEAR },
    create: { year: DEMO_SEASON_YEAR },
    update: {},
  });
  const playerIds: string[] = [];
  for (const name of FAKE_PLAYERS) {
    const email = `${name.toLowerCase()}@${DEMO_FAKE_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, emailVerified: new Date() },
      update: {},
    });
    const existing = await prisma.player.findFirst({ where: { ownerUserId: user.id } });
    const player = existing ?? (await prisma.player.create({ data: { name, ownerUserId: user.id } }));
    playerIds.push(player.id);
  }
  return { season, playerIds };
}

async function createWeek(
  seasonId: string,
  weekNumber: number,
  weekIdx: number,
  games: Pair[],
  playerIds: string[],
  opts: { finished: boolean },
) {
  const exists = await prisma.week.findUnique({
    where: { seasonId_weekNumber: { seasonId, weekNumber } },
  });
  if (exists) return;

  const now = Date.now();
  const kickoff = new Date(now - (HISTORY.length + 1 - weekNumber) * 7 * DAY);
  let week;
  try {
    week = await prisma.week.create({
      data: {
        seasonId,
        weekNumber,
        locksAt: kickoff,
        introMarkdown: weekNumber === CURRENT_WEEK
          ? "Welcome to the **App Review demo week**! Everything here is sample data. 🥚 Can you find the egg?"
          : "",
      },
    });
  } catch {
    return; // another request created it first
  }

  const created: Game[] = [];
  for (const [i, [away, home]] of games.entries()) {
    const s = scores(weekIdx, i);
    created.push(
      await prisma.game.create({
        data: {
          weekId: week.id,
          awayTeam: away,
          homeTeam: home,
          kickoff,
          sortOrder: i,
          status: opts.finished ? "FINAL" : "SCHEDULED",
          homeScore: opts.finished ? s.home : null,
          awayScore: opts.finished ? s.away : null,
        },
      }),
    );
  }

  const picks = playerIds.flatMap((playerId, p) =>
    picksFor(p, weekIdx, games).map((pick, i) => ({
      playerId,
      gameId: created[i].id,
      pickedTeam: pick.team,
      confidence: pick.confidence,
    })),
  );
  await prisma.pick.createMany({ data: picks, skipDuplicates: true });
}

let lastRefresh = 0;
const REFRESH_MS = 30_000;

// Re-bases the current week's lock times on "now".
async function refreshCurrentWeek(seasonId: string) {
  const week = await prisma.week.findUnique({
    where: { seasonId_weekNumber: { seasonId, weekNumber: CURRENT_WEEK } },
    include: { games: true },
  });
  if (!week) return;
  const now = Date.now();
  await prisma.week.update({ where: { id: week.id }, data: { locksAt: new Date(now + 3 * DAY) } });
  for (const g of week.games) {
    const data =
      g.sortOrder === 0
        ? {
            kickoff: new Date(now - HOUR),
            locksAt: new Date(now - HOUR),
            status: "FINAL",
            homeScore: 24,
            awayScore: 20,
          }
        : g.sortOrder === 1
          ? { kickoff: new Date(now + DAY), locksAt: new Date(now + DAY) }
          : { kickoff: new Date(now + 3 * DAY), locksAt: null };
    await prisma.game.update({ where: { id: g.id }, data });
  }
}

// Returns the demo season, creating/refreshing the fixture as needed.
export async function ensureDemoSeason(): Promise<Season> {
  const { season, playerIds } = await ensureSeasonAndPlayers();
  for (const [idx, games] of HISTORY.entries()) {
    await createWeek(season.id, idx + 1, idx, games, playerIds, { finished: true });
  }
  await createWeek(season.id, CURRENT_WEEK, HISTORY.length, CURRENT, playerIds, { finished: false });

  if (Date.now() - lastRefresh > REFRESH_MS) {
    lastRefresh = Date.now();
    await refreshCurrentWeek(season.id);
  }
  return season;
}
