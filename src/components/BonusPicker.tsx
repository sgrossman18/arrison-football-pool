"use client";

import { useState, useTransition } from "react";
import { submitBonusGuess } from "@/app/bonus/actions";
import type { BonusChoice } from "@/lib/bonus";

const CHOICES: { value: BonusChoice; label: string; emoji: string; selected: string; idle: string }[] = [
  {
    value: "BOY",
    label: "Boy",
    emoji: "💙",
    selected: "bg-sky-500 border-sky-500 text-white shadow-md shadow-sky-500/30",
    idle: "border-sky-400/60 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10",
  },
  {
    value: "GIRL",
    label: "Girl",
    emoji: "💗",
    selected: "bg-pink-500 border-pink-500 text-white shadow-md shadow-pink-500/30",
    idle: "border-pink-400/60 text-pink-700 dark:text-pink-300 hover:bg-pink-500/10",
  },
];

// One boy/girl chooser per player the login owns. Guesses save immediately and
// can be changed until an admin reveals the answer.
export default function BonusPicker({
  playerId,
  playerName,
  initialGuess,
  disabled = false,
  showName = true,
}: {
  playerId: string;
  playerName: string;
  initialGuess: BonusChoice | null;
  disabled?: boolean;
  showName?: boolean;
}) {
  const [guess, setGuess] = useState<BonusChoice | null>(initialGuess);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function choose(value: BonusChoice) {
    if (disabled || isPending) return;
    const previous = guess;
    setGuess(value);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await submitBonusGuess(playerId, value);
      if (result.ok) {
        setSaved(true);
      } else {
        setGuess(previous);
        setError(result.error ?? "Something went wrong. Try again.");
      }
    });
  }

  return (
    <div>
      {showName && <div className="text-sm font-semibold mb-2">{playerName}</div>}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={`${playerName}'s guess`}>
        {CHOICES.map((c) => {
          const isSelected = guess === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => choose(c.value)}
              className={`rounded-2xl border-2 px-4 py-4 text-lg font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                isSelected ? c.selected : `bg-surface ${c.idle}`
              }`}
            >
              <span className="mr-1.5">{c.emoji}</span>
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-5 mt-2 text-sm">
        {error ? (
          <span className="text-red-600 dark:text-red-400 font-medium">{error}</span>
        ) : saved ? (
          <span className="text-accent-strong font-medium">Guess saved ✓ — you can change it until the reveal.</span>
        ) : guess && !disabled ? (
          <span className="text-muted">Your guess: {guess === "BOY" ? "boy" : "girl"}. Tap the other to change it.</span>
        ) : null}
      </div>
    </div>
  );
}
