import { prisma } from "@/lib/db";
import { editableGames } from "@/lib/locking";
import { validatePickSubmission } from "@/lib/pick-validation";

export type PickInput = { gameId: string; pickedTeam: string; confidence: number };

// Saves one player's picks for a week. Shared by the web server action and the
// mobile API so both apply exactly the same ownership, lock, burn-rule and
// validation checks. Callers handle auth (who `userId` is) and cache revalidation.
export async function savePicks({
  userId,
  weekId,
  playerId,
  picks,
}: {
  userId: string;
  weekId: string;
  playerId: string;
  picks: PickInput[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.ownerUserId !== userId) {
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

  return { ok: true };
}
