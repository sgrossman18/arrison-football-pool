export type SubmissionGame = { id: string; homeTeam: string; awayTeam: string };
export type SubmittedPick = { gameId: string; pickedTeam: string; confidence: number };

// Checks a pick submission. `editableGameIds` are the games the player can
// still change; `lockedPicks` are their existing picks on games that have
// locked, whose confidence values are spent — a locked game's number can't
// be reused on a game that's still open.
export function validatePickSubmission({
  games,
  editableGameIds,
  lockedPicks,
  picks,
}: {
  games: SubmissionGame[];
  editableGameIds: Set<string>;
  lockedPicks: { confidence: number }[];
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

  const confidences = [...picks.map((p) => p.confidence), ...lockedPicks.map((p) => p.confidence)];
  if (new Set(confidences).size !== confidences.length) {
    return {
      ok: false,
      error:
        lockedPicks.length > 0
          ? "Confidence values must be unique — numbers on games that already locked can't be reused."
          : "Confidence values must be unique.",
    };
  }
  return { ok: true };
}
