"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { editableGames } from "@/lib/locking";
import { validatePickSubmission } from "@/lib/pick-validation";
import { revalidatePath } from "next/cache";

export async function submitPicks(
  weekId: string,
  playerId: string,
  picks: { gameId: string; pickedTeam: string; confidence: number }[],
) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.ownerUserId !== session.user.id) {
    return { ok: false, error: "That picker profile isn't yours." };
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { games: true, lockOverrides: true },
  });
  if (!week) return { ok: false, error: "Week not found." };

  const weekLock = { locksAt: week.locksAt, gameKickoffs: week.games.map((g) => g.kickoff) };
  const overrides = week.lockOverrides.map((o) => ({ playerId: o.playerId, expiresAt: o.expiresAt }));
  const editable = editableGames(week.games, weekLock, overrides, playerId);
  const editableGameIds = new Set(editable.map((g) => g.id));

  // Picks on games that already locked stay as they were, and the confidence
  // numbers they used can't be reused on games that are still open.
  const existing = await prisma.pick.findMany({
    where: { playerId, gameId: { in: week.games.map((g) => g.id) } },
  });
  const lockedPicks = existing.filter((p) => !editableGameIds.has(p.gameId));

  const check = validatePickSubmission({ games: week.games, editableGameIds, lockedPicks, picks });
  if (!check.ok) return { ok: false, error: check.error };

  await prisma.$transaction(
    picks.map((p) =>
      prisma.pick.upsert({
        where: { playerId_gameId: { playerId, gameId: p.gameId } },
        create: {
          playerId,
          gameId: p.gameId,
          pickedTeam: p.pickedTeam,
          confidence: p.confidence,
        },
        update: { pickedTeam: p.pickedTeam, confidence: p.confidence },
      }),
    ),
  );

  revalidatePath("/picks");
  revalidatePath("/results");
  revalidatePath("/standings");

  return { ok: true };
}
