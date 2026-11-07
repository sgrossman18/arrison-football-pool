export type SubmissionGame = { id: string; homeTeam: string; awayTeam: string };
export type SubmittedPick = { gameId: string; pickedTeam: string; confidence: number };

// Confidence numbers that are no longer available once some games have
// locked: the numbers on the picks made for those games ("used"), plus one
// "burned" number for every locked game with no pick — always the largest
// number still free, so skipping a game costs you your best numbers.
export function spentConfidences(
  totalGames: number,
  lockedGameIds: string[],
  picks: { gameId: string; confidence: number }[],
): { used: number[]; burned: number[]; spent: Set<number> } {
  const confByGame = new Map(picks.map((p) => [p.gameId, p.confidence]));
  const used = lockedGameIds
    .filter((id) => confByGame.has(id))
    .map((id) => confByGame.get(id)!);
  const missed = lockedGameIds.length - used.length;

  const usedSet = new Set(used);
  const burned: number[] = [];
  for (let v = totalGames; v >= 1 && burned.length < missed; v--) {
    if (!usedSet.has(v)) burned.push(v);
  }
  return { used, burned, spent: new Set([...used, ...burned]) };
}

// Checks a pick submission. `editableGameIds` are the games the player can
// still change; `lockedPicks` are their existing picks on the games that have
// locked. Numbers spent on locked games (picked or skipped — see
// spentConfidences) can't be reused on games that are still open.
export function validatePickSubmission({
  games,
  editableGameIds,
  lockedPicks,
  picks,
}: {
  games: SubmissionGame[];
  editableGameIds: Set<string>;
  lockedPicks: { gameId: string; confidence: number }[];
  picks: SubmittedPick[];
}): { ok: true } | { ok: false; error: string } {
  if (editableGameIds.size === 0) {
    return { ok: false, error: "Picks are locked for this week." };
  }

  const gameById = new Map(games.map((g) => [g.id, g]));
  for (const p of picks) {
    if (!gameById.has(p.gameId)) return { ok: false, error: "Invalid game." };
  }
  if (picks.some((p) => !editableGameIds.has(p.gameId))) {
    return {
      ok: false,
      error: "Some of these games just locked — reload the page and check your picks.",
    };
  }
  const submittedIds = new Set(picks.map((p) => p.gameId));
  if (submittedIds.size !== picks.length || picks.length !== editableGameIds.size) {
    return {
      ok: false,
      error:
        editableGameIds.size === games.length
          ? "You must pick every game."
          : "You must pick every game that's still open.",
    };
  }

  for (const p of picks) {
    const game = gameById.get(p.gameId)!;
    if (p.pickedTeam !== game.homeTeam && p.pickedTeam !== game.awayTeam) {
      return { ok: false, error: "Invalid team pick." };
    }
    if (!Number.isInteger(p.confidence) || p.confidence < 1 || p.confidence > games.length) {
      return { ok: false, error: "Invalid confidence value." };
    }
  }

  const lockedGameIds = games.filter((g) => !editableGameIds.has(g.id)).map((g) => g.id);
  const { spent } = spentConfidences(games.length, lockedGameIds, lockedPicks);
  const confidences = picks.map((p) => p.confidence);
  if (new Set(confidences).size !== confidences.length) {
    return { ok: false, error: "Confidence values must be unique." };
  }
  if (confidences.some((c) => spent.has(c))) {
    return {
      ok: false,
      error:
        "Some of those numbers are used up — games that already locked use theirs, and any locked game you didn't pick burns your largest free number.",
    };
  }
  return { ok: true };
}
