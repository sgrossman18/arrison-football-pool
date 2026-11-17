"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";
import { isBonusChoice } from "@/lib/bonus";

// Save (or change) a player's guess for the current week's bonus point. Any
// player the signed-in login owns can be guessed for, so a parent can guess
// for their kids. Guesses close the moment the answer is revealed.
export async function submitBonusGuess(
  playerId: string,
  guess: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };
  if (!isBonusChoice(guess)) return { ok: false, error: "Pick boy or girl." };

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.ownerUserId !== session.user.id) {
    return { ok: false, error: "That isn't one of your players." };
  }

  const week = await getCurrentWeek();
  if (!week?.bonusEnabled) return { ok: false, error: "The bonus point isn't open yet." };
  if (week.bonusRevealed) return { ok: false, error: "The answer has already been revealed." };

  await prisma.bonusGuess.upsert({
    where: { weekId_playerId: { weekId: week.id, playerId } },
    create: { weekId: week.id, playerId, guess },
    update: { guess },
  });

  revalidatePath("/bonus");
  return { ok: true };
}

const MAX_NAME_LENGTH = 60;

// Save a player's just-for-fun guess at the baby's name. It rides on their
// boy/girl guess (so they pick that first) and earns no points. An empty name
// clears it.
export async function submitNameGuess(
  playerId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const text = name.trim().replace(/\s+/g, " ");
  if (text.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `That's a long name — ${MAX_NAME_LENGTH} characters max.` };
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player || player.ownerUserId !== session.user.id) {
    return { ok: false, error: "That isn't one of your players." };
  }

  const week = await getCurrentWeek();
  if (!week?.bonusEnabled) return { ok: false, error: "The bonus point isn't open yet." };
  if (week.bonusRevealed) return { ok: false, error: "The answer has already been revealed." };

  const updated = await prisma.bonusGuess.updateMany({
    where: { weekId: week.id, playerId },
    data: { nameGuess: text || null },
  });
  if (updated.count === 0) return { ok: false, error: "Pick boy or girl first." };

  revalidatePath("/bonus");
  revalidatePath(`/admin/weeks/${week.id}`);
  return { ok: true };
}
