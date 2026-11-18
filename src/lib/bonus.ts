import { prisma } from "@/lib/db";
import { getSeasonWeeks, pickCurrentWeek } from "@/lib/season";

// The weekly "bonus point" question: a one-off guess (currently boy or girl)
// that earns every correct guesser +1 for that week once an admin reveals the
// answer. Players never see it until an admin enables it for the week.

export type BonusChoice = "BOY" | "GIRL";

export const BONUS_CHOICES: BonusChoice[] = ["BOY", "GIRL"];

export function isBonusChoice(value: unknown): value is BonusChoice {
  return value === "BOY" || value === "GIRL";
}

// Generic copy for the question. The heading, blurb and picture are per-week
// and live in the database (set from the admin week page).
export const BONUS_COPY = {
  defaultHeading: "Bonus point!",
  question: "Boy or girl? Make your guess below.",
  prize:
    "Guess right and you get a bonus point added to your score for the week. We'll reveal the answer after the week's games.",
};

// weekId → players who guessed right, for weeks whose answer has been
// revealed. Weeks that aren't revealed (or have no answer) are absent, so
// nobody earns anything early.
export async function getBonusWinners(weekIds: string[]): Promise<Map<string, string[]>> {
  const winners = new Map<string, string[]>();
  if (weekIds.length === 0) return winners;

  const weeks = await prisma.week.findMany({
    where: { id: { in: weekIds }, bonusRevealed: true, bonusAnswer: { not: null } },
    select: { id: true, bonusAnswer: true },
  });
  if (weeks.length === 0) return winners;

  const guesses = await prisma.bonusGuess.findMany({
    where: { weekId: { in: weeks.map((w) => w.id) } },
    select: { weekId: true, playerId: true, guess: true },
  });
  const answerByWeek = new Map(weeks.map((w) => [w.id, w.bonusAnswer]));
  for (const g of guesses) {
    if (g.guess !== answerByWeek.get(g.weekId)) continue;
    const list = winners.get(g.weekId) ?? [];
    list.push(g.playerId);
    winners.set(g.weekId, list);
  }
  return winners;
}

// The week the Bonus Point page is about. Normally the newest week with the
// question switched on that is the current week or later — so it can go live
// ahead of the week rolling over (the "current" week only flips Tuesday evening)
// and drops back to the Egg once that week has passed. An admin can preview any
// week by number; otherwise a week that isn't switched on falls back to the
// current one so the page has something to show.
export async function getBonusWeek(previewWeekNumber?: number) {
  const weeks = await getSeasonWeeks();
  if (previewWeekNumber != null) {
    const found = weeks.find((w) => w.weekNumber === previewWeekNumber);
    if (found) return found;
  }
  const current = pickCurrentWeek(weeks);
  const live = weeks.filter(
    (w) => w.bonusEnabled && (!current || w.weekNumber >= current.weekNumber),
  );
  return live[live.length - 1] ?? current;
}

// Whether the nav should advertise "Bonus Point" instead of "Egg" right now.
export async function isBonusLive(): Promise<boolean> {
  const week = await getBonusWeek();
  return Boolean(week?.bonusEnabled);
}

// Hints are typed one per line, and often pasted with their own "Hints:"
// heading and "1)" numbering; strip both since the page numbers them itself.
export function parseHints(text: string | null): string[] {
  return (text ?? "")
    .split("\n")
    .map((h) => h.trim().replace(/^(?:\d+\s*[.)]|[-•*])\s*/, ""))
    .filter((h) => h && !/^hints?\s*:?$/i.test(h));
}
