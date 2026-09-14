"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createPlayer(name: string) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name can't be empty." };

  const player = await prisma.player.create({
    data: { name: trimmed, ownerUserId: session.user.id },
  });

  revalidatePath("/picks");
  return { ok: true, playerId: player.id };
}
