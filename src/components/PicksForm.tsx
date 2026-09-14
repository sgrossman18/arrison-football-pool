"use client";

import { useState, useTransition } from "react";
import { teamName } from "@/lib/teams";

export type PicksFormGame = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO
};

export type PicksFormInitialPick = {
  gameId: string;
  pickedTeam: string;
  confidence: number;
};

export default function PicksForm({
  games,
  initialPicks,
  canSubmit,
  lockMessage,
  submitAction,
}: {
  games: PicksFormGame[];
  initialPicks: PicksFormInitialPick[];
  canSubmit: boolean;
  lockMessage?: string;
  submitAction: (
    picks: { gameId: string; pickedTeam: string; confidence: number }[],
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const initialTeamByGame = Object.fromEntries(
    initialPicks.map((p) => [p.gameId, p.pickedTeam]),
  );
  const initialConfByGame = Object.fromEntries(
    initialPicks.map((p) => [p.gameId, p.confidence]),
  );

  const [teamByGame, setTeamByGame] = useState<Record<string, string>>(initialTeamByGame);
  const [confByGame, setConfByGame] = useState<Record<string, number>>(initialConfByGame);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const n = games.length;
  const confidenceOptions = Array.from({ length: n }, (_, i) => i + 1);

  function pickTeam(gameId: string, team: string) {
    setSuccess(false);
    setTeamByGame((prev) => ({ ...prev, [gameId]: team }));
  }

  function pickConfidence(gameId: string, value: number) {
    setSuccess(false);
    setConfByGame((prev) => {
      const next = { ...prev };
      // Keep confidence values unique: whoever else had this value loses it.
      for (const [gid, v] of Object.entries(next)) {
        if (v === value && gid !== gameId) delete next[gid];
      }
      next[gameId] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missingTeam = games.some((g) => !teamByGame[g.id]);
    if (missingTeam) {
      setError("Pick a winner for every game.");
      return;
    }
    const usedConfidences = games.map((g) => confByGame[g.id]);
    if (usedConfidences.some((c) => !c)) {
      setError("Set a confidence value (1-5) for every game.");
      return;
    }
    const unique = new Set(usedConfidences);
    if (unique.size !== n) {
      setError("Each confidence value can only be used once.");
      return;
    }

    startTransition(async () => {
      const result = await submitAction(
        games.map((g) => ({
          gameId: g.id,
          pickedTeam: teamByGame[g.id],
          confidence: confByGame[g.id],
        })),
      );
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!canSubmit && (
        <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm">
          {lockMessage ?? "Picks are locked for this week."}
        </div>
      )}
      {canSubmit && lockMessage && (
        <div className="rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 px-4 py-3 text-sm">
          {lockMessage}
        </div>
      )}

      {games.map((game) => (
        <div
          key={game.id}
          className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex gap-2">
            {[game.awayTeam, game.homeTeam].map((team) => (
              <button
                type="button"
                key={team}
                disabled={!canSubmit}
                onClick={() => pickTeam(game.id, team)}
                className={`rounded-md px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  teamByGame[game.id] === team
                    ? "bg-emerald-700 border-emerald-700 text-white"
                    : "border-neutral-300 dark:border-neutral-700 hover:border-emerald-600"
                }`}
              >
                {teamName(team)}
              </button>
            ))}
            <span className="self-center text-xs text-neutral-500 px-1">
              {game.awayTeam} @ {game.homeTeam}
            </span>
          </div>

          <label className="flex items-center gap-2 text-sm">
            Confidence
            <select
              disabled={!canSubmit}
              value={confByGame[game.id] ?? ""}
              onChange={(e) => pickConfidence(game.id, Number(e.target.value))}
              className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 disabled:opacity-50"
            >
              <option value="" disabled>
                --
              </option>
              {confidenceOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}

      {error && (
        <div className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</div>
      )}
      {success && (
        <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          Picks saved!
        </div>
      )}

      {canSubmit && (
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-md bg-emerald-700 text-white px-5 py-2.5 font-medium hover:bg-emerald-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save picks"}
        </button>
      )}
    </form>
  );
}
