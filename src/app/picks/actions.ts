"use server";

import { auth } from "@/lib/auth";
import { savePicks } from "@/lib/picks-service";
import { revalidatePath } from "next/cache";

export async function submitPicks(
  weekId: string,
  playerId: string,
  picks: { gameId: string; pickedTeam: string; confidence: number }[],
) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const result = await savePicks({ userId: session.user.id, weekId, playerId, picks });
  if (!result.ok) return result;

  revalidatePath("/picks");
  revalidatePath("/results");
  revalidatePath("/standings");

  return { ok: true };
}
