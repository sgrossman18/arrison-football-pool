"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSubmitPicks } from "@/lib/locking";
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

  const allowed = canSubmitPicks(
    { locksAt: week.locksAt, gameKickoffs: week.games.map((g) => g.kickoff) },
    week.lockOverrides.map((o) => ({ playerId: o.playerId, expiresAt: o.expiresAt })),
    playerId,
  );
  if (!allowed) {
    return { ok: false, error: "Picks are locked for this week." };
  }

  const gameIds = new Set(week.games.map((g) => g.id));
  if (picks.length !== week.games.length) {
    return { ok: false, error: "You must pick every game." };
  }
  for (const p of picks) {
    if (!gameIds.has(p.gameId)) return { ok: false, error: "Invalid game." };
    const game = week.games.find((g) => g.id === p.gameId)!;
    if (p.pickedTeam !== game.homeTeam && p.pickedTeam !== game.awayTeam) {
      return { ok: false, error: "Invalid team pick." };
    }
    if (p.confidence < 1 || p.confidence > week.games.length) {
      return { ok: false, error: "Invalid confidence value." };
    }
  }
  const confidences = picks.map((p) => p.confidence);
  if (new Set(confidences).size !== confidences.length) {
    return { ok: false, error: "Confidence values must be unique." };
  }

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
