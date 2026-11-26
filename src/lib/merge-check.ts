export type MergePick = {
  confidence: number;
  game: {
    weekId: string;
    homeTeam: string;
    awayTeam: string;
    week: { weekNumber: number };
  };
};

// Merging puts two profiles' picks under one player, who may only use each
// confidence number once per week. Returns one line for every moving pick
// whose number is already on a different game in the account being kept.
// `moved` must leave out picks for games the kept account already picked,
// since those are dropped rather than moved.
export function findNumberClashes(moved: MergePick[], kept: MergePick[]): string[] {
  const key = (p: MergePick) => `${p.game.weekId}:${p.confidence}`;
  const matchup = (p: MergePick) => `${p.game.awayTeam} @ ${p.game.homeTeam}`;
  const keptByKey = new Map(kept.map((p) => [key(p), p]));
  return moved
    .filter((p) => keptByKey.has(key(p)))
    .sort((a, b) => a.game.week.weekNumber - b.game.week.weekNumber || b.confidence - a.confidence)
    .map(
      (p) =>
        `Week ${p.game.week.weekNumber}, number ${p.confidence}: ${matchup(p)} on the duplicate and ${matchup(keptByKey.get(key(p))!)} on the account you're keeping`,
    );
}
