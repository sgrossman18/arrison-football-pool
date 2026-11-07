// Each week has a main deadline (weeks.locksAt, or the earliest game's
// kickoff for old weeks) that every game locks at by default. Games that must
// lock earlier — Thanksgiving, Friday and Saturday games — carry their own
// games.locksAt, so picks lock in stages through the week. An admin can also
// grant a specific player a LockOverride to submit/edit past every lock
// (e.g. the kid who missed the deadline for a soccer tournament).

export type WeekLockInfo = {
  locksAt: Date | null;
  gameKickoffs: Date[];
};

type GameLock = { locksAt: Date | null };

// The week's main deadline.
export function effectiveLockTime(week: WeekLockInfo): Date | null {
  if (week.locksAt) return week.locksAt;
  if (week.gameKickoffs.length === 0) return null;
  return new Date(Math.min(...week.gameKickoffs.map((d) => d.getTime())));
}

// When picks for one game lock: its own time if set, else the week's.
export function gameLockTime(game: GameLock, week: WeekLockInfo): Date | null {
  return game.locksAt ?? effectiveLockTime(week);
}

export function isGameLocked(game: GameLock, week: WeekLockInfo, now: Date = new Date()): boolean {
  const lockTime = gameLockTime(game, week);
  return !!lockTime && now.getTime() >= lockTime.getTime();
}

// When the first game in the week locks — the moment the week "starts".
export function firstLockTime(games: GameLock[], week: WeekLockInfo): Date | null {
  const times = games
    .map((g) => gameLockTime(g, week))
    .filter((t): t is Date => t !== null)
    .map((t) => t.getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

// The soonest lock that hasn't happened yet, or null once everything's locked.
export function nextUpcomingLock(
  games: GameLock[],
  week: WeekLockInfo,
  now: Date = new Date(),
): Date | null {
  const times = games
    .map((g) => gameLockTime(g, week))
    .filter((t): t is Date => t !== null && t.getTime() > now.getTime())
    .map((t) => t.getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

export function hasActiveOverride(
  overrides: { playerId: string; expiresAt: Date | null }[],
  playerId: string,
  now: Date = new Date(),
): boolean {
  return overrides.some(
    (o) =>
      o.playerId === playerId && (!o.expiresAt || o.expiresAt.getTime() > now.getTime()),
  );
}

// The games this player can still pick or change right now: every game with
// an active exception, otherwise just the ones that haven't locked.
export function editableGames<G extends GameLock>(
  games: G[],
  week: WeekLockInfo,
  overrides: { playerId: string; expiresAt: Date | null }[],
  playerId: string,
  now: Date = new Date(),
): G[] {
  if (hasActiveOverride(overrides, playerId, now)) return games;
  return games.filter((g) => !isGameLocked(g, week, now));
}
