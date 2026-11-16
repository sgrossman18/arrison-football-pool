import { prisma } from "@/lib/db";
import type { Season } from "@prisma/client";
import { getSeasonWeeks, pickCurrentWeek } from "@/lib/season";
import {
  effectiveLockTime,
  gameLockTime,
  hasActiveOverride,
  isGameLocked,
} from "@/lib/locking";
import { spentConfidences } from "@/lib/pick-validation";
import {
  computeSeasonStandings,
  computeWeekScores,
  formatRank,
  isDroppableWeek,
  pickPoints,
  rankStandings,
} from "@/lib/scoring";
import { formatEastern, formatEasternWeekday } from "@/lib/timezone";
import { maybeSyncActiveWeeks } from "@/lib/sync-scores";
import { notFound } from "@/lib/api/errors";
import { DEMO_SEASON_YEAR } from "@/lib/demo";
import { serverTime } from "@/lib/api/http";

// Response builders for the mobile API. They mirror what the web pages compute
// (same libs, same copy) so the app only renders — it never re-derives a rule.

// The App Review fixture season is stored under a reserved internal year; show
// the current calendar year instead.
function displayYear(season: Season): number {
  return season.year === DEMO_SEASON_YEAR ? new Date().getFullYear() : season.year;
}

export async function listPlayers(userId: string) {
  const players = await prisma.player.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return players;
}

export async function buildWeeksList(season: Season) {
  const allWeeks = await getSeasonWeeks(season);
  const current = pickCurrentWeek(allWeeks);
  return {
    serverTime: serverTime(),
    seasonYear: displayYear(season),
    currentWeekNumber: current && current.games.length > 0 ? current.weekNumber : null,
    weeks: allWeeks
      .filter((w) => w.games.length > 0)
      .map((w) => ({
        weekNumber: w.weekNumber,
        gameCount: w.games.length,
        droppable: isDroppableWeek(w.games.length),
      })),
  };
}

export async function buildPicksState({
  userId,
  season,
  weekNumber,
  playerId,
  now = new Date(),
}: {
  userId: string;
  season: Season;
  weekNumber: number;
  playerId?: string | null;
  now?: Date;
}) {
  const players = await listPlayers(userId);
  if (players.length === 0) throw notFound("Add your name first.");
  const player = playerId ? players.find((p) => p.id === playerId) : players[0];
  if (!player) throw notFound("That picker profile isn't yours.");

  const weeks = await getSeasonWeeks(season);
  const week = weeks.find((w) => w.weekNumber === weekNumber && w.games.length > 0);
  if (!week) throw notFound("That week isn't set up yet.");

  const existingPicks = await prisma.pick.findMany({
    where: { playerId: player.id, gameId: { in: week.games.map((g) => g.id) } },
  });
  const pickByGame = new Map(existingPicks.map((p) => [p.gameId, p]));

  const weekLockInfo = { locksAt: week.locksAt, gameKickoffs: week.games.map((g) => g.kickoff) };
  const overrides = week.lockOverrides.map((o) => ({ playerId: o.playerId, expiresAt: o.expiresAt }));
  const weekLock = effectiveLockTime(weekLockInfo);
  const overridden = hasActiveOverride(overrides, player.id, now);

  const states = week.games.map((g) => {
    const lockTime = gameLockTime(g, weekLockInfo);
    return { game: g, lockTime, locked: !overridden && isGameLocked(g, weekLockInfo, now) };
  });
  const openStates = states.filter((s) => !s.locked);
  const canSubmit = openStates.length > 0;
  const staged = new Set(states.map((s) => s.lockTime?.getTime() ?? null)).size > 1;
  const someLocked = states.some((s) => s.locked);

  const lockMessage =
    overridden && states.some((s) => isGameLocked(s.game, weekLockInfo, now))
      ? "Some of this week's games have locked, but you've been given an exception — go ahead and submit."
      : !canSubmit && weekLock
        ? `Picks locked at ${formatEastern(weekLock)}.`
        : canSubmit && someLocked
          ? "Some games have already locked (marked below). Their picks and the confidence numbers on them are final — use your remaining numbers on the games still open."
          : null;

  const firstOpenLock = openStates
    .map((s) => s.lockTime)
    .filter((t): t is Date => t !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const deadlineNote = !canSubmit
    ? null
    : staged
      ? "Games lock at different times this week — the deadline for each game is shown below. You can change a pick as many times as you want until its game locks."
      : firstOpenLock
        ? `You can change these picks as many times as you want until ${formatEastern(firstOpenLock)}.`
        : null;

  const confirmDeadlinePhrase = staged
    ? "each game's deadline"
    : firstOpenLock
      ? `kickoff on ${formatEasternWeekday(firstOpenLock)}`
      : "the deadline";

  const lockedIds = states.filter((s) => s.locked).map((s) => s.game.id);
  const { used, burned, spent } = spentConfidences(
    week.games.length,
    lockedIds,
    existingPicks.map((p) => ({ gameId: p.gameId, confidence: p.confidence })),
  );
  const availableConfidences: number[] = [];
  for (let n = 1; n <= week.games.length; n++) if (!spent.has(n)) availableConfidences.push(n);

  return {
    serverTime: now.toISOString(),
    week: {
      weekNumber: week.weekNumber,
      gameCount: week.games.length,
      introMarkdown: week.introMarkdown,
    },
    player,
    games: states.map(({ game: g, lockTime, locked }) => {
      const pick = pickByGame.get(g.id);
      return {
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        kickoff: g.kickoff.toISOString(),
        locksAt: lockTime?.toISOString() ?? null,
        locked,
        lockLabel: locked ? "Locked" : staged && lockTime ? `Locks ${formatEastern(lockTime)}` : null,
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        myPick: pick ? { pickedTeam: pick.pickedTeam, confidence: pick.confidence } : null,
      };
    }),
    spent: { used: [...used].sort((a, b) => a - b), burned: [...burned].sort((a, b) => a - b) },
    availableConfidences,
    canSubmit,
    staged,
    overridden,
    messages: { lockMessage, deadlineNote, confirmDeadlinePhrase },
  };
}

export async function findWeekId(season: Season, weekNumber: number): Promise<string> {
  const weeks = await getSeasonWeeks(season);
  const week = weeks.find((w) => w.weekNumber === weekNumber && w.games.length > 0);
  if (!week) throw notFound("That week isn't set up yet.");
  return week.id;
}

export async function buildResults({
  userId,
  season,
  weekNumber,
  now = new Date(),
}: {
  userId: string;
  season: Season;
  weekNumber: number;
  now?: Date;
}) {
  await maybeSyncActiveWeeks();

  const weekNumbers = (
    await prisma.week.findMany({
      where: { seasonId: season.id, games: { some: {} } },
      orderBy: { weekNumber: "desc" },
      select: { weekNumber: true },
    })
  ).map((w) => w.weekNumber);

  const week = await prisma.week.findUnique({
    where: { seasonId_weekNumber: { seasonId: season.id, weekNumber } },
    include: { games: { orderBy: [{ sortOrder: "asc" }, { kickoff: "asc" }] } },
  });
  if (!week || week.games.length === 0) throw notFound("That week isn't set up yet.");

  const picks = await prisma.pick.findMany({
    where: { gameId: { in: week.games.map((g) => g.id) } },
    include: { player: true },
  });

  // Other people's picks are hidden game by game: a game's picks open up the
  // moment that game locks, not when the whole week does.
  const weekLockInfo = { locksAt: week.locksAt, gameKickoffs: week.games.map((g) => g.kickoff) };
  const lockedGameIds = new Set(
    week.games.filter((g) => isGameLocked(g, weekLockInfo, now)).map((g) => g.id),
  );
  const anyLocked = lockedGameIds.size > 0;
  const allLocked = lockedGameIds.size === week.games.length;

  const players = new Map(picks.map((p) => [p.playerId, p.player]));
  const scores = computeWeekScores(
    week.games,
    picks.map((p) => ({
      playerId: p.playerId,
      gameId: p.gameId,
      pickedTeam: p.pickedTeam,
      confidence: p.confidence,
    })),
  );

  const rows = [...players.values()]
    .map((pl) => ({
      player: pl,
      total: scores.get(pl.id)?.points ?? 0,
      complete: scores.get(pl.id)?.complete ?? false,
    }))
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));

  const banner = allLocked
    ? null
    : anyLocked
      ? "Other people's picks are hidden for games that haven't locked yet — they appear as each game locks."
      : "Picks aren't locked yet — other people's picks are hidden until they are.";

  return {
    serverTime: now.toISOString(),
    weekNumber: week.weekNumber,
    weekNumbers,
    banner,
    games: week.games.map((g) => ({
      id: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      status: g.status,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      locked: lockedGameIds.has(g.id),
    })),
    rows: rows.map(({ player, total, complete }) => {
      const isMine = player.ownerUserId === userId;
      const totalVisible = anyLocked || isMine;
      return {
        playerId: player.id,
        name: player.name,
        isMine,
        total: totalVisible ? total : null,
        totalVisible,
        complete,
        picks: week.games.map((g) => {
          const pick = picks.find((p) => p.playerId === player.id && p.gameId === g.id);
          if (!pick) return { gameId: g.id, state: "none" as const };
          // Redacted on the server: hidden picks carry no team or confidence.
          if (!isMine && !lockedGameIds.has(g.id)) return { gameId: g.id, state: "hidden" as const };
          const earned = pickPoints(
            {
              playerId: pick.playerId,
              gameId: pick.gameId,
              pickedTeam: pick.pickedTeam,
              confidence: pick.confidence,
            },
            g,
          );
          return {
            gameId: g.id,
            state: earned === null ? ("pending" as const) : earned > 0 ? ("correct" as const) : ("wrong" as const),
            pickedTeam: pick.pickedTeam,
            confidence: pick.confidence,
            points: earned,
          };
        }),
      };
    }),
  };
}

export async function buildStandings(userId: string, season: Season) {
  await maybeSyncActiveWeeks();

  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id, games: { some: {} } },
    orderBy: { weekNumber: "asc" },
    include: { games: true },
  });

  const picks = await prisma.pick.findMany({
    where: { gameId: { in: weeks.flatMap((w) => w.games.map((g) => g.id)) } },
  });
  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const playerById = new Map(players.map((p) => [p.id, p]));

  const standings = rankStandings(
    computeSeasonStandings(
      weeks.map((w) => ({
        weekNumber: w.weekNumber,
        games: w.games,
        picks: picks
          .filter((p) => w.games.some((g) => g.id === p.gameId))
          .map((p) => ({
            playerId: p.playerId,
            gameId: p.gameId,
            pickedTeam: p.pickedTeam,
            confidence: p.confidence,
          })),
      })),
      playerIds,
    ),
  );

  return {
    serverTime: serverTime(),
    seasonYear: displayYear(season),
    dropCount: Math.max(0, ...standings.map((s) => s.droppedWeeks.length)),
    weeks: weeks.map((w) => ({
      weekNumber: w.weekNumber,
      gameCount: w.games.length,
      droppable: isDroppableWeek(w.games.length),
      complete: w.games.every((g) => g.status === "FINAL"),
    })),
    rows: standings.map((s) => {
      const player = playerById.get(s.playerId);
      return {
        playerId: s.playerId,
        name: player?.name ?? "?",
        isMine: player?.ownerUserId === userId,
        rank: s.rank,
        tied: s.tied,
        rankLabel: formatRank(s),
        weekly: s.weeklyTotals.map((w) => ({
          weekNumber: w.weekNumber,
          points: w.points,
          complete: w.complete,
          dropped: s.droppedWeeks.includes(w.weekNumber),
        })),
        seasonTotal: s.seasonTotal,
        bestTotal: s.bestTotal,
      };
    }),
  };
}
