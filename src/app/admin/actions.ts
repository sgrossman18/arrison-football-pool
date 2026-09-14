"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { easternDateAt1pmToUtc, formatEastern } from "@/lib/timezone";
import { effectiveLockTime } from "@/lib/locking";

export async function createNextWeek() {
  await requireAdmin();
  const season = await getOrCreateCurrentSeason();
  const last = await prisma.week.findFirst({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "desc" },
  });
  const week = await prisma.week.create({
    data: { seasonId: season.id, weekNumber: (last?.weekNumber ?? 0) + 1 },
  });
  revalidatePath("/admin");
  redirect(`/admin/weeks/${week.id}`);
}

export async function updateIntro(weekId: string, introMarkdown: string) {
  await requireAdmin();
  await prisma.week.update({ where: { id: weekId }, data: { introMarkdown } });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

// The pool's whole deadline model: every game a given week locks at the
// same fixed time (1:00 PM ET) on one date the admin sets once — no more
// picking a kickoff per game. `date` is a plain YYYY-MM-DD string, or null
// to clear it (falls back to no deadline until set again).
export async function setWeekDeadline(weekId: string, date: string | null) {
  await requireAdmin();
  await prisma.week.update({
    where: { id: weekId },
    data: { locksAt: date ? easternDateAt1pmToUtc(date) : null },
  });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

export async function addGame(weekId: string, data: { homeTeam: string; awayTeam: string }) {
  await requireAdmin();
  const week = await prisma.week.findUniqueOrThrow({ where: { id: weekId } });
  await prisma.game.create({
    data: {
      weekId,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      // Games no longer track a real kickoff — every game locks with the
      // week's single deadline, so this just mirrors it for the (now
      // vestigial, but still non-null) column.
      kickoff: week.locksAt ?? new Date(),
    },
  });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

export async function updateGame(
  gameId: string,
  weekId: string,
  data: { homeTeam: string; awayTeam: string },
) {
  await requireAdmin();

  const existing = await prisma.game.findUnique({ where: { id: gameId } });
  const matchupChanged =
    existing && (existing.homeTeam !== data.homeTeam || existing.awayTeam !== data.awayTeam);

  await prisma.game.update({
    where: { id: gameId },
    data: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      // A changed matchup invalidates any scores already pulled in for it.
      ...(matchupChanged && { status: "SCHEDULED", homeScore: null, awayScore: null, espnEventId: null }),
    },
  });

  // Existing picks reference the old teams — swapping the matchup makes them
  // meaningless (they'd silently score 0 forever instead of erroring), so
  // clear them and let people re-pick.
  if (matchupChanged) {
    await prisma.pick.deleteMany({ where: { gameId } });
  }

  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
  revalidatePath("/results");
}

export async function deleteGame(gameId: string, weekId: string) {
  await requireAdmin();
  await prisma.game.delete({ where: { id: gameId } });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

export async function grantLockOverride(weekId: string, playerId: string, note?: string) {
  await requireAdmin();
  await prisma.lockOverride.upsert({
    where: { weekId_playerId: { weekId, playerId } },
    create: { weekId, playerId, note },
    update: { note },
  });
  revalidatePath(`/admin/weeks/${weekId}`);
}

export async function revokeLockOverride(weekId: string, playerId: string) {
  await requireAdmin();
  await prisma.lockOverride.delete({ where: { weekId_playerId: { weekId, playerId } } });
  revalidatePath(`/admin/weeks/${weekId}`);
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { isAdmin } });
  revalidatePath("/admin/users");
}

export async function syncScoresNow() {
  await requireAdmin();
  const { syncAllActiveWeeks } = await import("@/lib/sync-scores");
  const result = await syncAllActiveWeeks();
  revalidatePath("/results");
  revalidatePath("/standings");
  return result;
}

export async function sendPickReminders(weekId: string) {
  await requireAdmin();

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { games: true },
  });
  if (!week) return { sent: 0, error: "Week not found." };
  if (week.games.length === 0) return { sent: 0, error: "No games set up yet." };

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

  // One email per login, even if it owns multiple not-done players (e.g. a
  // parent picking for a couple of kids).
  const namesByUser = new Map<string, { email: string; names: string[] }>();
  for (const p of notDonePlayers) {
    const existing = namesByUser.get(p.ownerUserId);
    if (existing) {
      existing.names.push(p.name);
    } else {
      namesByUser.set(p.ownerUserId, { email: p.owner.email, names: [p.name] });
    }
  }

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

  return { sent };
}
