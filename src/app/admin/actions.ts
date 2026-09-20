"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { getOrCreateCurrentSeason } from "@/lib/season";
import {
  easternDateAt1pmToUtc,
  utcToEasternDateOnly,
  addDaysToDateOnly,
  nextEasternSundayDateOnly,
} from "@/lib/timezone";
import { effectiveLockTime } from "@/lib/locking";

export async function createNextWeek() {
  await requireAdmin();
  const season = await getOrCreateCurrentSeason();
  const last = await prisma.week.findFirst({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "desc" },
    include: { games: true },
  });

  // Default the new week's deadline to Sunday 1pm ET — the Sunday right
  // after the previous week's deadline if there is one, otherwise the next
  // upcoming Sunday from today. Uses the *effective* lock time (falls back
  // to computing from real per-game kickoffs) rather than the raw
  // `locksAt` column, since a week set up under the old per-game-kickoff
  // flow never has `locksAt` set at all — using the raw column would
  // default the new week to the *same* Sunday as the last one instead of
  // the next one.
  const lastDeadline = last
    ? effectiveLockTime({
        locksAt: last.locksAt,
        gameKickoffs: last.games.map((g) => g.kickoff),
      })
    : null;
  const defaultDeadlineDate = lastDeadline
    ? addDaysToDateOnly(utcToEasternDateOnly(lastDeadline), 7)
    : nextEasternSundayDateOnly();

  const week = await prisma.week.create({
    data: {
      seasonId: season.id,
      weekNumber: (last?.weekNumber ?? 0) + 1,
      locksAt: easternDateAt1pmToUtc(defaultDeadlineDate),
    },
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

export async function renamePlayer(playerId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name can't be empty." };
  await prisma.player.update({ where: { id: playerId }, data: { name: trimmed } });
  revalidatePath("/admin/users");
  revalidatePath("/picks");
  revalidatePath("/results");
  revalidatePath("/standings");
  return { ok: true };
}

// Deleting a player cascades their picks and lock overrides everywhere
// (schema-level onDelete: Cascade) — this removes them from every week's
// results and the season standings, not just going forward.
export async function deletePlayer(playerId: string) {
  await requireAdmin();
  await prisma.player.delete({ where: { id: playerId } });
  revalidatePath("/admin/users");
  revalidatePath("/results");
  revalidatePath("/standings");
  return { ok: true };
}

export async function createPlayerForUser(userId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name can't be empty." };
  await prisma.player.create({ data: { ownerUserId: userId, name: trimmed } });
  revalidatePath("/admin/users");
  return { ok: true };
}

// For the "same person ended up with two logins" case (e.g. someone's .edu
// email had trouble so they signed in with a personal Gmail instead,
// creating a second picker). Moves every pick and lock override from
// `sourcePlayerId` onto `targetPlayerId`, then deletes the source player —
// so all of that person's history lives under one entry in results and
// standings. If both players happened to pick the same game (e.g. they
// used both logins in the same week), the target's existing pick is kept
// and the source's conflicting one is dropped rather than silently
// overwriting real data either direction.
export async function mergePlayers(sourcePlayerId: string, targetPlayerId: string) {
  await requireAdmin();
  if (sourcePlayerId === targetPlayerId) {
    return { ok: false, error: "Can't merge a player into itself." };
  }

  const [source, target] = await Promise.all([
    prisma.player.findUnique({
      where: { id: sourcePlayerId },
      include: { picks: true, lockOverrides: true },
    }),
    prisma.player.findUnique({ where: { id: targetPlayerId } }),
  ]);
  if (!source || !target) return { ok: false, error: "Player not found." };

  const [targetPicks, targetOverrides] = await Promise.all([
    prisma.pick.findMany({ where: { playerId: targetPlayerId }, select: { gameId: true } }),
    prisma.lockOverride.findMany({ where: { playerId: targetPlayerId }, select: { weekId: true } }),
  ]);
  const targetGameIds = new Set(targetPicks.map((p) => p.gameId));
  const targetWeekIds = new Set(targetOverrides.map((o) => o.weekId));

  const picksToMove = source.picks.filter((p) => !targetGameIds.has(p.gameId));
  const overridesToMove = source.lockOverrides.filter((o) => !targetWeekIds.has(o.weekId));
  const skippedPicks = source.picks.length - picksToMove.length;

  await prisma.$transaction([
    ...picksToMove.map((p) =>
      prisma.pick.update({ where: { id: p.id }, data: { playerId: targetPlayerId } }),
    ),
    ...overridesToMove.map((o) =>
      prisma.lockOverride.update({ where: { id: o.id }, data: { playerId: targetPlayerId } }),
    ),
    // Cascades away anything left on source (the conflicting duplicates we
    // deliberately didn't move).
    prisma.player.delete({ where: { id: sourcePlayerId } }),
  ]);

  revalidatePath("/admin/users");
  revalidatePath("/results");
  revalidatePath("/standings");
  revalidatePath("/picks");
  return { ok: true, movedPicks: picksToMove.length, skippedPicks };
}

// Only for a login that's been fully merged away (no players left) — lets
// the admin fully remove an abandoned duplicate email rather than leaving
// it sitting around as a dead account. Refuses if it still owns any
// players, so this can't be used to accidentally wipe someone's season.
export async function deleteUserLogin(userId: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { players: true } });
  if (!user) return { ok: false, error: "User not found." };
  if (user.players.length > 0) {
    return {
      ok: false,
      error: "This login still has picker profiles — merge or remove those first.",
    };
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return { ok: true };
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
  const { sendRemindersForWeek } = await import("@/lib/reminders");
  const { sent, error } = await sendRemindersForWeek(weekId);
  return { sent, error };
}
