"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";

const MAX_LENGTH = 1000;

export async function submitEgg(response: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not signed in." };

  const text = response.trim();
  if (!text) return { ok: false, error: "Tell me what you found first." };
  if (text.length > MAX_LENGTH) {
    return { ok: false, error: `That's too long — ${MAX_LENGTH} characters max.` };
  }

  const week = await getCurrentWeek();
  if (!week) return { ok: false, error: "There's no active week right now." };

  await prisma.eggSubmission.create({
    data: { weekId: week.id, userId: session.user.id, response: text },
  });

  revalidatePath("/egg");
  revalidatePath("/results");
  return { ok: true };
}
