import { authedRoute, json } from "@/lib/api/http";
import { buildWeeksList } from "@/lib/api/views";

export const GET = authedRoute(async () => json(await buildWeeksList()));
