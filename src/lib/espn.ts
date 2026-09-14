// Free, unofficial ESPN scoreboard feed — no API key required. This is the
// same data ESPN's own site/app reads from. It can change shape without
// notice; sync-scores degrades gracefully (skips games it can't parse)
// rather than throwing, so one bad week doesn't take down the whole cron.
const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// ESPN's team abbreviations differ from ours in a couple of spots.
const ESPN_ABBR_FIXUP: Record<string, string> = {
  WAS: "WSH",
  JAC: "JAX",
  LA: "LAR",
};

function normalizeAbbr(espnAbbr: string): string {
  return ESPN_ABBR_FIXUP[espnAbbr] ?? espnAbbr;
}

type EspnCompetitor = {
  homeAway: "home" | "away";
  team: { abbreviation: string };
  score?: string | number;
};

export type EspnGameResult = {
  espnEventId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINAL";
  kickoff: string;
};

// seasontype: 2 = regular season, 3 = postseason
export async function fetchWeekScoreboard(
  year: number,
  week: number,
  seasontype = 2,
): Promise<EspnGameResult[]> {
  const url = `${SCOREBOARD_URL}?year=${year}&week=${week}&seasontype=${seasontype}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ESPN scoreboard request failed: ${res.status}`);
  }
  const data = await res.json();

  const results: EspnGameResult[] = [];
  for (const event of data.events ?? []) {
    try {
      const competition = event.competitions?.[0];
      const competitors: EspnCompetitor[] = competition?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const completed = competition.status?.type?.completed === true;
      const state = competition.status?.type?.state; // "pre" | "in" | "post"
      const status: EspnGameResult["status"] = completed
        ? "FINAL"
        : state === "in"
          ? "IN_PROGRESS"
          : "SCHEDULED";

      results.push({
        espnEventId: String(event.id),
        homeTeam: normalizeAbbr(home.team.abbreviation),
        awayTeam: normalizeAbbr(away.team.abbreviation),
        homeScore:
          home.score !== undefined && home.score !== null ? Number(home.score) : null,
        awayScore:
          away.score !== undefined && away.score !== null ? Number(away.score) : null,
        status,
        kickoff: competition.date ?? event.date,
      });
    } catch {
      // Skip anything we can't parse rather than failing the whole sync.
      continue;
    }
  }
  return results;
}
