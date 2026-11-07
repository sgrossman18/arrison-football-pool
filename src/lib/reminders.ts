import { prisma } from "@/lib/db";
import { effectiveLockTime, gameLockTime, nextUpcomingLock } from "@/lib/locking";
import { formatEastern } from "@/lib/timezone";

// Emails everyone who hasn't picked the games that lock next — one email per
// login, even if it owns several not-done players (e.g. a parent picking for
// kids). In a normal week that's every game; in a staged week (Thanksgiving,
// Friday/Saturday games) it's whichever games lock soonest, so nobody gets
// nagged about Sunday's games on Wednesday. With dryRun, returns who would be
// emailed without sending anything.
export async function sendRemindersForWeek(weekId: string, opts: { dryRun?: boolean } = {}) {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { games: true },
  });
  if (!week) return { sent: 0, recipients: [] as string[], error: "Week not found." };
  if (week.games.length === 0) {
    return { sent: 0, recipients: [] as string[], error: "No games set up yet." };
  }

  const allPlayers = await prisma.player.findMany({ include: { owner: true } });
  const picks = await prisma.pick.findMany({
    where: { gameId: { in: week.games.map((g) => g.id) } },
    select: { playerId: true, gameId: true },
  });
  const pickedGamesByPlayer = new Map<string, Set<string>>();
  for (const p of picks) {
    if (!pickedGamesByPlayer.has(p.playerId)) pickedGamesByPlayer.set(p.playerId, new Set());
    pickedGamesByPlayer.get(p.playerId)!.add(p.gameId);
  }
  const weekLock = {
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  };
  const lockTime = nextUpcomingLock(week.games, weekLock) ?? effectiveLockTime(weekLock);
  const targetGames = lockTime
    ? week.games.filter((g) => gameLockTime(g, weekLock)?.getTime() === lockTime.getTime())
    : week.games;
  const targetGameIds = targetGames.length > 0 ? targetGames.map((g) => g.id) : week.games.map((g) => g.id);
  const staged = new Set(week.games.map((g) => gameLockTime(g, weekLock)?.getTime())).size > 1;

  const notDonePlayers = allPlayers.filter((p) => {
    const picked = pickedGamesByPlayer.get(p.id);
    return targetGameIds.some((id) => !picked?.has(id));
  });

  const namesByUser = new Map<string, { email: string; names: string[] }>();
  for (const p of notDonePlayers) {
    const existing = namesByUser.get(p.ownerUserId);
    if (existing) {
      existing.names.push(p.name);
    } else {
      namesByUser.set(p.ownerUserId, { email: p.owner.email, names: [p.name] });
    }
  }

  const recipients = [...namesByUser.values()].map((r) => r.email);
  if (opts.dryRun) return { sent: 0, recipients };

  const deadlineText = lockTime ? `at ${formatEastern(lockTime)}` : null;
  const siteUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { sendEmails, pickReminderEmail } = await import("@/lib/email");
  const messages = [...namesByUser.values()].map(({ email, names }) =>
    pickReminderEmail({
      to: email,
      weekNumber: week.weekNumber,
      playerNames: names,
      deadlineText,
      partialWeek: staged,
      siteUrl,
    }),
  );
  await sendEmails(messages);

  return { sent: messages.length, recipients };
}
