import { resolveSeason } from "@/lib/api/season-scope";
import { authedRoute, json, readJson, serverTime } from "@/lib/api/http";
import { invalid } from "@/lib/api/errors";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";

const MAX_LENGTH = 1000;

const toDto = (s: { id: string; response: string; createdAt: Date }) => ({
  id: s.id,
  response: s.response,
  createdAt: s.createdAt.toISOString(),
});

// The caller's own guesses for the current week. Grading stays on the web.
export const GET = authedRoute(async (_req, { user }) => {
  const week = await getCurrentWeek(await resolveSeason(user));
  const mine = week
    ? await prisma.eggSubmission.findMany({
        where: { weekId: week.id, userId: user.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  return json({
    serverTime: serverTime(),
    weekNumber: week?.weekNumber ?? null,
    submissions: mine.map(toDto),
  });
});

export const POST = authedRoute(async (req, { user }) => {
  const body = await readJson<{ response?: unknown }>(req);
  const text = typeof body.response === "string" ? body.response.trim() : "";
  if (!text) throw invalid("Tell me what you found first.");
  if (text.length > MAX_LENGTH) throw invalid(`That's too long — ${MAX_LENGTH} characters max.`);

  const week = await getCurrentWeek(await resolveSeason(user));
  if (!week) throw invalid("There's no active week right now.");

  const created = await prisma.eggSubmission.create({
    data: { weekId: week.id, userId: user.id, response: text },
  });
  return json({ submission: toDto(created) }, 201);
});
