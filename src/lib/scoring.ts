// Confidence-pool grading rules (confirmed with the pool commissioner):
//  - Pick the winner of each of the week's games; you earn your confidence
//    value (1-5, used once each) for every game you get right.
//  - A tied game awards points to everyone who picked either team in it —
//    nobody is "wrong" on a tie.
//  - Season standings drop each player's 3 lowest weekly totals, once more
//    than 3 weeks have been fully graded (see computeSeasonStandings).
//
// "Player" here means a pool participant/picker, not a login — one login
// (User) can own several Players (e.g. a parent submitting for their kids).

export type GameLite = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // SCHEDULED | IN_PROGRESS | FINAL
};

export type PickLite = {
  playerId: string;
  gameId: string;
  pickedTeam: string;
  confidence: number;
};

export type GameOutcome = "HOME" | "AWAY" | "TIE" | null;

export function gameOutcome(game: GameLite): GameOutcome {
  if (game.status !== "FINAL" || game.homeScore == null || game.awayScore == null) {
    return null;
  }
  if (game.homeScore > game.awayScore) return "HOME";
  if (game.awayScore > game.homeScore) return "AWAY";
  return "TIE";
}

// Points earned for a single pick: null while the game hasn't finished yet.
export function pickPoints(pick: PickLite, game: GameLite): number | null {
  const outcome = gameOutcome(game);
  if (outcome === null) return null;
  if (outcome === "TIE") return pick.confidence;
  const winningTeam = outcome === "HOME" ? game.homeTeam : game.awayTeam;
  return pick.pickedTeam === winningTeam ? pick.confidence : 0;
}

export type PlayerWeekResult = {
  points: number;
  gradedGames: number;
  totalGames: number;
  complete: boolean; // every game in the week is FINAL
};

// One week's per-player point totals.
export function computeWeekScores(
  games: GameLite[],
  picks: PickLite[],
): Map<string, PlayerWeekResult> {
  const results = new Map<string, PlayerWeekResult>();
  const byPlayer = new Map<string, PickLite[]>();
  for (const pick of picks) {
    if (!byPlayer.has(pick.playerId)) byPlayer.set(pick.playerId, []);
    byPlayer.get(pick.playerId)!.push(pick);
  }

  const allGraded = games.every((g) => g.status === "FINAL");

  for (const [playerId, playerPicks] of byPlayer) {
    let points = 0;
    let gradedGames = 0;
    for (const pick of playerPicks) {
      const game = games.find((g) => g.id === pick.gameId);
      if (!game) continue;
      const earned = pickPoints(pick, game);
      if (earned !== null) {
        points += earned;
        gradedGames += 1;
      }
    }
    results.set(playerId, {
      points,
      gradedGames,
      totalGames: games.length,
      complete: allGraded,
    });
  }
  return results;
}

export type WeekForStandings = {
  weekNumber: number;
  games: GameLite[];
  picks: PickLite[];
};

export type SeasonStanding = {
  playerId: string;
  weeklyTotals: { weekNumber: number; points: number; complete: boolean }[];
  seasonTotal: number;
  droppedWeeks: number[]; // week numbers dropped
  bestTotal: number; // seasonTotal minus the 3 lowest complete-week totals
};

const WEEKS_TO_DROP = 3;

export function computeSeasonStandings(
  weeks: WeekForStandings[],
  playerIds: string[],
): SeasonStanding[] {
  const perWeek = weeks.map((w) => ({
    weekNumber: w.weekNumber,
    scores: computeWeekScores(w.games, w.picks),
  }));

  return playerIds.map((playerId) => {
    const weeklyTotals = perWeek.map(({ weekNumber, scores }) => {
      const r = scores.get(playerId);
      return { weekNumber, points: r?.points ?? 0, complete: r?.complete ?? false };
    });

    const seasonTotal = weeklyTotals.reduce((sum, w) => sum + w.points, 0);

    const completeWeeks = weeklyTotals.filter((w) => w.complete);
    let droppedWeeks: number[] = [];
    let bestTotal = seasonTotal;

    // Only start dropping weeks once there's enough season to make it
    // meaningful — otherwise an early 0-point bye week would tank a total
    // that's really "not enough data yet".
    if (completeWeeks.length > WEEKS_TO_DROP) {
      const lowest = [...completeWeeks]
        .sort((a, b) => a.points - b.points)
        .slice(0, WEEKS_TO_DROP);
      droppedWeeks = lowest.map((w) => w.weekNumber);
      bestTotal = seasonTotal - lowest.reduce((sum, w) => sum + w.points, 0);
    }

    return { playerId, weeklyTotals, seasonTotal, droppedWeeks, bestTotal };
  });
}
