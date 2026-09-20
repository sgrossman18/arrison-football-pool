import { prisma } from "@/lib/db";
import { effectiveLockTime } from "@/lib/locking";
import { formatEastern } from "@/lib/timezone";

// Emails everyone who hasn't finished their picks for a week — one email per
// login, even if it owns several not-done players (e.g. a parent picking for
// kids). With dryRun, returns who would be emailed without sending anything.
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
  const notDonePlayers = allPlayers.filter(
    (p) => (pickedGamesByPlayer.get(p.id)?.size ?? 0) < week.games.length,
  );

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

  const lockTime = effectiveLockTime({
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  });
  const deadlineText = lockTime ? `at ${formatEastern(lockTime)}` : null;
  const siteUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const { sendPickReminderEmail } = await import("@/lib/email");
  let sent = 0;
  for (const { email, names } of namesByUser.values()) {
    await sendPickReminderEmail({
      to: email,
      weekNumber: week.weekNumber,
      playerNames: names,
      deadlineText,
      siteUrl,
    });
    sent += 1;
  }

  return { sent, recipients };
}
