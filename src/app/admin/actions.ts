"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { easternDatetimeLocalToUtc } from "@/lib/timezone";

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

export async function setWeekLockOverrideTime(weekId: string, locksAt: string | null) {
  await requireAdmin();
  await prisma.week.update({
    where: { id: weekId },
    data: { locksAt: locksAt ? easternDatetimeLocalToUtc(locksAt) : null },
  });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

export async function addGame(
  weekId: string,
  data: { homeTeam: string; awayTeam: string; kickoff: string },
) {
  await requireAdmin();
  await prisma.game.create({
    data: {
      weekId,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      kickoff: easternDatetimeLocalToUtc(data.kickoff),
    },
  });
  revalidatePath(`/admin/weeks/${weekId}`);
  revalidatePath("/picks");
}

export async function updateGame(
  gameId: string,
  weekId: string,
  data: { homeTeam: string; awayTeam: string; kickoff: string },
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
      kickoff: easternDatetimeLocalToUtc(data.kickoff),
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
