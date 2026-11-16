import { resolveSeason } from "@/lib/api/season-scope";
import { authedRoute, json } from "@/lib/api/http";
import { buildStandings } from "@/lib/api/views";

export const GET = authedRoute(async (_req, { user }) =>
  json(await buildStandings(user.id, await resolveSeason(user))),
);
