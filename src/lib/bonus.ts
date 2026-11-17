import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";

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

// Whether the nav should advertise "Bonus Point" instead of "Egg" right now.
export async function isBonusLive(): Promise<boolean> {
  const week = await getCurrentWeek();
  return Boolean(week?.bonusEnabled);
}
