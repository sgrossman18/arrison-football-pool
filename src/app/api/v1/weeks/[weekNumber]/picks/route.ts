import { resolveSeason } from "@/lib/api/season-scope";
import { authedRoute, json, readJson } from "@/lib/api/http";
import { invalid, notFound } from "@/lib/api/errors";
import { buildPicksState, findWeekId } from "@/lib/api/views";
import { savePicks, type PickInput } from "@/lib/picks-service";

function parseWeekNumber(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw notFound("That week isn't set up yet.");
  return n;
}

export const GET = authedRoute<{ weekNumber: string }>(async (req, { params, user }) => {
  const weekNumber = parseWeekNumber(params.weekNumber);
  const playerId = req.nextUrl.searchParams.get("playerId");
  const season = await resolveSeason(user);
  return json(await buildPicksState({ userId: user.id, season, weekNumber, playerId }));
});

export const PUT = authedRoute<{ weekNumber: string }>(async (req, { params, user }) => {
  const weekNumber = parseWeekNumber(params.weekNumber);
  const body = await readJson<{ playerId?: unknown; picks?: unknown }>(req);
  if (typeof body.playerId !== "string" || !Array.isArray(body.picks)) {
    throw invalid("Invalid picks.");
  }
  const picks: PickInput[] = [];
  for (const p of body.picks) {
    if (
      !p ||
      typeof p.gameId !== "string" ||
      typeof p.pickedTeam !== "string" ||
      typeof p.confidence !== "number"
    ) {
      throw invalid("Invalid picks.");
    }
    picks.push({ gameId: p.gameId, pickedTeam: p.pickedTeam, confidence: p.confidence });
  }

  const season = await resolveSeason(user);
  const weekId = await findWeekId(season, weekNumber);
  const result = await savePicks({ userId: user.id, weekId, playerId: body.playerId, picks });
  if (!result.ok) throw invalid(result.error);
  return json(await buildPicksState({ userId: user.id, season, weekNumber, playerId: body.playerId }));
});
