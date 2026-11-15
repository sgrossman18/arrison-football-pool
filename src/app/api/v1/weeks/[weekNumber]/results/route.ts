import { authedRoute, json } from "@/lib/api/http";
import { notFound } from "@/lib/api/errors";
import { buildResults } from "@/lib/api/views";

export const GET = authedRoute<{ weekNumber: string }>(async (_req, { params, user }) => {
  const weekNumber = Number(params.weekNumber);
  if (!Number.isInteger(weekNumber) || weekNumber < 1) throw notFound("That week isn't set up yet.");
  return json(await buildResults({ userId: user.id, weekNumber }));
});
