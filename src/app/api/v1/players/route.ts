import { authedRoute, json, readJson } from "@/lib/api/http";
import { invalid } from "@/lib/api/errors";
import { prisma } from "@/lib/db";

const MAX_NAME_LENGTH = 40;

export const POST = authedRoute(async (req, { user }) => {
  const body = await readJson<{ name?: unknown }>(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw invalid("Name can't be empty.");
  if (name.length > MAX_NAME_LENGTH) throw invalid(`Name is too long — ${MAX_NAME_LENGTH} characters max.`);
  const player = await prisma.player.create({
    data: { name, ownerUserId: user.id },
    select: { id: true, name: true },
  });
  return json({ player }, 201);
});
