import Link from "next/link";
import BonusPicker from "@/components/BonusPicker";
import { BONUS_COPY, type BonusChoice } from "@/lib/bonus";

export type BonusPlayerView = {
  id: string;
  name: string;
  guess: BonusChoice | null;
  nameGuess: string;
};

export type BonusViewProps = {
  weekNumber: number;
  players: BonusPlayerView[];
  // Set once an admin reveals the answer; null while guessing is open.
  revealedAnswer: BonusChoice | null;
  guessCount: number;
  // Revealed only: names of everyone who guessed right.
  winnerNames: string[];
  // Revealed only: everyone's just-for-fun baby-name guesses.
  nameGuesses: { playerName: string; name: string }[];
  // Admin looking at a page players can't see yet: shows a banner and keeps
  // the buttons from saving real guesses.
  previewNotLive: boolean;
  heading: string | null;
  blurb: string | null;
  hasImage: boolean;
  hints: string[];
};

const label = (c: BonusChoice) => (c === "BOY" ? "boy" : "girl");

export default function BonusView({
  weekNumber,
  players,
  revealedAnswer,
  guessCount,
  winnerNames,
  nameGuesses,
  previewNotLive,
  heading,
  blurb,
  hasImage,
  hints,
}: BonusViewProps) {
  return (
    <div className="max-w-xl mx-auto">
      {previewNotLive && (
        <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm font-medium mb-5">
          Admin preview — players can&apos;t see this yet, and guesses are off. Turn it on from
          this week&apos;s admin page.
        </div>
      )}

      <h1 className="text-3xl font-extrabold tracking-tight mb-1">🍼 Bonus Point</h1>
      <p className="text-sm text-muted mb-5">Week {weekNumber}</p>

      <div className="rounded-3xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className={`px-5 pt-6 text-center ${hasImage ? "pb-4" : "pb-6"}`}>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {heading || BONUS_COPY.defaultHeading}
          </h2>
          {blurb && <p className="text-muted mt-1.5">{blurb}</p>}
        </div>
        {hasImage && (
          <div className="px-5 pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated route, not optimizable */}
            <img
              src={`/bonus/image?week=${weekNumber}`}
              alt="Bonus point picture"
              className="w-full rounded-2xl border border-border bg-black"
            />
          </div>
        )}
      </div>

      {revealedAnswer ? (
        <div className="mt-6">
          <div
            className={`rounded-3xl px-5 py-7 text-center text-white shadow-lg ${
              revealedAnswer === "GIRL" ? "bg-pink-500 shadow-pink-500/30" : "bg-sky-500 shadow-sky-500/30"
            }`}
          >
            <div className="text-sm font-semibold uppercase tracking-widest opacity-90">It&apos;s a…</div>
            <div className="text-5xl font-extrabold tracking-tight mt-1">
              {revealedAnswer === "GIRL" ? "Girl! 🎀" : "Boy! 💙"}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {players.map((p) => {
              const right = p.guess === revealedAnswer;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    right ? "border-accent bg-accent-soft" : "border-border bg-surface"
                  }`}
                >
                  <span className="font-semibold">{p.name}</span>
                  {p.guess === null ? (
                    <span className="text-muted"> didn&apos;t guess this time.</span>
                  ) : right ? (
                    <span>
                      {" "}
                      guessed {label(p.guess)} — <strong>+1 bonus point! 🎉</strong>
                    </span>
                  ) : (
                    <span className="text-muted"> guessed {label(p.guess)}. So close!</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-sm text-muted mt-5">
            {winnerNames.length === 0
              ? "Nobody guessed it."
              : `${winnerNames.length} of ${guessCount} guessed right: ${winnerNames.join(", ")}.`}{" "}
            Bonus points are added to Week {weekNumber} on the{" "}
            <Link href="/results" className="text-accent-strong font-medium hover:underline">
              results
            </Link>{" "}
            and{" "}
            <Link href="/standings" className="text-accent-strong font-medium hover:underline">
              standings
            </Link>{" "}
            pages.
          </p>

          {nameGuesses.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface px-5 py-4 mt-6">
              <h2 className="text-lg font-extrabold tracking-tight">💬 The baby-name guesses</h2>
              <p className="text-xs text-muted mb-3">Just for fun — no points, plenty of pressure.</p>
              <ul className="flex flex-col gap-1.5 text-sm">
                {nameGuesses.map((g) => (
                  <li key={g.playerName} className="flex items-baseline justify-between gap-3">
                    <span className="text-muted">{g.playerName}</span>
                    <span className="font-semibold text-right break-words">{g.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          {hints.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface-2 px-5 py-4 mb-6">
              <h2 className="text-lg font-extrabold tracking-tight mb-2">🔎 Hints</h2>
              <ol className="list-decimal pl-5 flex flex-col gap-1 text-sm">
                {hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </div>
          )}

          <h2 className="text-xl font-extrabold tracking-tight">{BONUS_COPY.question}</h2>
          <p className="text-sm text-muted mt-1 mb-4">{BONUS_COPY.prize}</p>

          {players.length === 0 ? (
            <p className="text-sm text-muted">
              Add yourself as a player on the{" "}
              <Link href="/picks" className="text-accent-strong font-medium hover:underline">
                picks page
              </Link>{" "}
              first, then come back to guess.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {players.map((p) => (
                <BonusPicker
                  key={p.id}
                  playerId={p.id}
                  playerName={p.name}
                  initialGuess={p.guess}
                  initialName={p.nameGuess}
                  disabled={previewNotLive}
                  showName={players.length > 1}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-muted mt-5">
            {guessCount === 0
              ? "No guesses yet — be the first!"
              : `${guessCount} ${guessCount === 1 ? "guess" : "guesses"} in so far. Everyone's picks stay secret until the reveal.`}
          </p>
        </div>
      )}

      <p className="text-xs text-muted mt-10">
        Looking for the easter egg instead?{" "}
        <Link href="/egg" className="text-accent-strong font-medium hover:underline">
          Submit it here
        </Link>
        .
      </p>
    </div>
  );
}
