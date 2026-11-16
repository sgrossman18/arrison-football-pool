import { resolveSeason } from "@/lib/api/season-scope";
import { authedRoute, json } from "@/lib/api/http";
import { buildWeeksList } from "@/lib/api/views";

export const GET = authedRoute(async (_req, { user }) =>
  json(await buildWeeksList(await resolveSeason(user))),
);
