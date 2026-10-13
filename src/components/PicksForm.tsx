"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

// White text on dark team colors, near-black on light ones (Steelers yellow,
// Saints gold) so the label stays readable either way.
function readableTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111111" : "#ffffff";
}

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
  const [showConfirm, setShowConfirm] = useState(false);

  const n = games.length;
  const confidenceOptions = Array.from({ length: n }, (_, i) => i + 1);
  const usedConfidences = new Set(Object.values(confByGame));

  function isComplete(teams: Record<string, string>, confs: Record<string, number>) {
    return (
      n > 0 &&
      games.every((g) => teams[g.id] && confs[g.id]) &&
      new Set(games.map((g) => confs[g.id])).size === n
    );
  }

  // Offer to submit the moment a pick turns the set from incomplete to
  // complete — not on every later tweak, which would nag people editing
  // already-saved picks.
  function maybePromptToSubmit(
    nextTeams: Record<string, string>,
    nextConfs: Record<string, number>,
  ) {
    if (!isComplete(teamByGame, confByGame) && isComplete(nextTeams, nextConfs)) {
      setShowConfirm(true);
    }
  }

  function pickTeam(gameId: string, team: string) {
    setSuccess(false);
    const next = { ...teamByGame, [gameId]: team };
    setTeamByGame(next);
    maybePromptToSubmit(next, confByGame);
  }

  function pickConfidence(gameId: string, value: number) {
    setSuccess(false);
    const next = { ...confByGame };
    // Keep confidence values unique: whoever else had this value loses it.
    for (const [gid, v] of Object.entries(next)) {
      if (v === value && gid !== gameId) delete next[gid];
    }
    next[gameId] = value;
    setConfByGame(next);
    maybePromptToSubmit(teamByGame, next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    save();
  }

  function save() {
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
      setShowConfirm(false);
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
                    aria-pressed={isSelected}
                    style={
                      isSelected
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            color: readableTextColor(color),
                            // The selection marker can't depend on the team's own
                            // color (Jaguars/Raiders/Bears are near-black and vanish
                            // in dark mode), so also draw a ring in the page's
                            // foreground color — white in dark mode, black in light.
                            outline: "2px solid var(--foreground)",
                            outlineOffset: "2px",
                          }
                        : undefined
                    }
                    className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold border-2 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      isSelected
                        ? "shadow-md"
                        : "border-border text-foreground hover:border-accent/50 bg-surface-2 disabled:opacity-50"
                    }`}
                  >
                    {isSelected ? (
                      <span aria-hidden className="shrink-0 font-bold">
                        ✓
                      </span>
                    ) : (
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
        <div className="text-sm text-accent-strong font-medium">
          Picks saved! Feel free to change them again before the deadline.
        </div>
      )}

      {canSubmit && (
        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto self-start rounded-full bg-accent text-white px-10 py-4 text-lg font-bold shadow-lg shadow-accent/25 hover:bg-accent-strong transition-colors disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save Picks"}
        </button>
      )}

      {showConfirm && (
        <ConfirmSubmitDialog
          isPending={isPending}
          onYes={save}
          onNo={() => setShowConfirm(false)}
        />
      )}
    </form>
  );
}

function ConfirmSubmitDialog({
  isPending,
  onYes,
  onNo,
}: {
  isPending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const yesRef = useRef<HTMLButtonElement>(null);
  const onNoRef = useRef(onNo);
  useEffect(() => {
    onNoRef.current = onNo;
  });

  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onNoRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onNo}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-submit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl"
      >
        <h2 id="confirm-submit-title" className="text-xl font-extrabold tracking-tight">
          Submit your picks?
        </h2>
        <p className="text-sm text-muted mt-2">
          You can change and re-submit your picks any time up until kickoff on Sunday.
        </p>
        <div className="flex gap-3 mt-5">
          <button
            ref={yesRef}
            type="button"
            disabled={isPending}
            onClick={onYes}
            className="flex-1 rounded-full bg-accent text-white px-5 py-3 font-bold hover:bg-accent-strong transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Yes"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onNo}
            className="flex-1 rounded-full border-2 border-border px-5 py-3 font-bold hover:border-accent/50 transition-colors disabled:opacity-60"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
