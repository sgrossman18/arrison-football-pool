// A week's picks lock as a whole once the first of its 5 games kicks off —
// matches how the old single Google Form submission worked. An admin can
// override the computed time per week (weeks.locksAt), and/or grant a
// specific player a LockOverride to submit/edit past the lock (e.g. the kid
// who missed the deadline for a soccer tournament).

export type WeekLockInfo = {
  locksAt: Date | null;
  gameKickoffs: Date[];
};

export function effectiveLockTime(week: WeekLockInfo): Date | null {
  if (week.locksAt) return week.locksAt;
  if (week.gameKickoffs.length === 0) return null;
  return new Date(Math.min(...week.gameKickoffs.map((d) => d.getTime())));
}

export function isWeekLocked(week: WeekLockInfo, now: Date = new Date()): boolean {
  const lockTime = effectiveLockTime(week);
  if (!lockTime) return false;
  return now.getTime() >= lockTime.getTime();
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

// Can this player submit/edit picks for this week right now?
export function canSubmitPicks(
  week: WeekLockInfo,
  overrides: { playerId: string; expiresAt: Date | null }[],
  playerId: string,
  now: Date = new Date(),
): boolean {
  if (!isWeekLocked(week, now)) return true;
  return hasActiveOverride(overrides, playerId, now);
}
