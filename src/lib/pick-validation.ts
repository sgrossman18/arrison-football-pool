export type SubmissionGame = { id: string; homeTeam: string; awayTeam: string };
export type SubmittedPick = { gameId: string; pickedTeam: string; confidence: number };

// Confidence numbers that are no longer available once some games have
// locked: the numbers on the picks made for those games ("used"), plus one
// "burned" number for every locked game with no pick — always the largest
// number still free, so skipping a game costs you your best numbers. "Free"
// means not on any saved pick: `picks` is everything the player has saved for
// the week, including games still open, so a number already parked on a later
// game is never burned out from under it.
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

  const held = new Set(picks.map((p) => p.confidence));
  const burned: number[] = [];
  for (let v = totalGames; v >= 1 && burned.length < missed; v--) {
    if (!held.has(v)) burned.push(v);
  }
  return { used, burned, spent: new Set([...used, ...burned]) };
}

// Checks a pick submission. A player can save any number of their open games
// at a time (e.g. just tonight's) and come back for the rest.
// `editableGameIds` are the games they can still change; `savedPicks` are all
// their existing picks for the week. Numbers spent on locked games (picked or
// skipped — see spentConfidences) can't be reused on games that are still
// open, and no two of a player's picks may share a number.
export function validatePickSubmission({
  games,
  editableGameIds,
  savedPicks,
  picks,
}: {
  games: SubmissionGame[];
  editableGameIds: Set<string>;
  savedPicks: { gameId: string; confidence: number }[];
  picks: SubmittedPick[];
}): { ok: true } | { ok: false; error: string } {
  if (editableGameIds.size === 0) {
    return { ok: false, error: "Picks are locked for this week." };
  }
  if (picks.length === 0) {
    return { ok: false, error: "Pick at least one game." };
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
  if (submittedIds.size !== picks.length) {
    return { ok: false, error: "Each game can only be picked once." };
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
  const { spent } = spentConfidences(games.length, lockedGameIds, savedPicks);
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
  // Open games saved earlier but not part of this submission keep their numbers.
  const kept = new Set(
    savedPicks
      .filter((p) => editableGameIds.has(p.gameId) && !submittedIds.has(p.gameId))
      .map((p) => p.confidence),
  );
  if (confidences.some((c) => kept.has(c))) {
    return {
      ok: false,
      error:
        "One of those numbers is already on another pick you saved — reload the page and check your picks.",
    };
  }
  return { ok: true };
}
