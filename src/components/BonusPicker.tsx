"use client";

import { useState, useTransition } from "react";
import { submitBonusGuess, submitNameGuess } from "@/app/bonus/actions";
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
  initialName = "",
  disabled = false,
  showName = true,
}: {
  playerId: string;
  playerName: string;
  initialGuess: BonusChoice | null;
  initialName?: string;
  disabled?: boolean;
  showName?: boolean;
}) {
  const [guess, setGuess] = useState<BonusChoice | null>(initialGuess);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [namePending, startNameTransition] = useTransition();

  function saveName() {
    if (disabled || namePending) return;
    setNameError(null);
    setNameSaved(false);
    startNameTransition(async () => {
      const result = await submitNameGuess(playerId, name);
      if (result.ok) setNameSaved(true);
      else setNameError(result.error ?? "Something went wrong. Try again.");
    });
  }

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

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          saveName();
        }}
      >
        <label className="block text-sm font-semibold mb-1.5" htmlFor={`name-${playerId}`}>
          Baby name guess <span className="text-muted font-normal">(just for fun, no points)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`name-${playerId}`}
            type="text"
            value={name}
            maxLength={60}
            disabled={disabled || !guess}
            onChange={(e) => {
              setName(e.target.value);
              setNameSaved(false);
            }}
            placeholder={guess ? "Write in a name…" : "Pick boy or girl first"}
            className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || !guess || namePending}
            className="rounded-full bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent-strong transition-colors disabled:opacity-60"
          >
            {namePending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="min-h-5 mt-1.5 text-sm">
          {nameError ? (
            <span className="text-red-600 dark:text-red-400 font-medium">{nameError}</span>
          ) : nameSaved ? (
            <span className="text-accent-strong font-medium">Name saved ✓</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
