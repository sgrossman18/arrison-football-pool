"use client";

import { useState, useTransition } from "react";
import { NFL_TEAMS, teamName } from "@/lib/teams";

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
  const usedConfidences = new Set(Object.values(confByGame));

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
    const confidences = games.map((g) => confByGame[g.id]);
    if (confidences.some((c) => !c)) {
      setError("Set a confidence value (1-5) for every game.");
      return;
    }
    const unique = new Set(confidences);
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
        <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm font-medium">
          {lockMessage ?? "Picks are locked for this week."}
        </div>
      )}
      {canSubmit && lockMessage && (
        <div className="rounded-xl bg-accent-soft text-accent-strong px-4 py-3 text-sm font-medium">
          {lockMessage}
        </div>
      )}

      {games.map((game) => {
        const picked = teamByGame[game.id];
        const confidence = confByGame[game.id];
        return (
          <div
            key={game.id}
            className="rounded-2xl border border-border bg-surface shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="text-xs text-muted font-medium w-24 shrink-0">
              {game.awayTeam} @ {game.homeTeam}
            </div>

            <div className="flex gap-2 flex-1">
              {[game.awayTeam, game.homeTeam].map((team) => {
                const isSelected = picked === team;
                const color = NFL_TEAMS[team]?.color ?? "#525252";
                return (
                  <button
                    type="button"
                    key={team}
                    disabled={!canSubmit}
                    onClick={() => pickTeam(game.id, team)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            // Guards against near-black/near-white team colors
                            // (e.g. Bears, Raiders) vanishing into the page background.
                            boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.4)",
                          }
                        : undefined
                    }
                    className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      isSelected
                        ? "text-white shadow-md"
                        : "border-border text-foreground hover:border-accent/50 bg-surface-2"
                    }`}
                  >
                    {!isSelected && (
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    {teamName(team)}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <span className="text-xs text-muted font-medium mr-1">Confidence</span>
              <div className="flex gap-1">
                {confidenceOptions.map((v) => {
                  const isSelected = confidence === v;
                  const isTakenElsewhere = usedConfidences.has(v) && !isSelected;
                  return (
                    <button
                      type="button"
                      key={v}
                      disabled={!canSubmit}
                      onClick={() => pickConfidence(game.id, v)}
                      className={`h-8 w-8 rounded-full text-sm font-semibold border-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-accent border-accent text-white shadow-sm"
                          : isTakenElsewhere
                            ? "border-border text-muted/40"
                            : "border-border text-foreground hover:border-accent/50"
                      }`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {error && <div className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</div>}
      {success && (
        <div className="text-sm text-accent-strong font-medium">Picks saved!</div>
      )}

      {canSubmit && (
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-accent text-white px-6 py-2.5 font-semibold shadow-md shadow-accent/20 hover:bg-accent-strong transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save picks"}
        </button>
      )}
    </form>
  );
}
