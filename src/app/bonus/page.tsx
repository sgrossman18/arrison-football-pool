import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentWeek } from "@/lib/season";
import { getBonusWinners, isBonusChoice } from "@/lib/bonus";
import BonusView from "@/components/BonusView";

export default async function BonusPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const week = await getCurrentWeek();
  const live = Boolean(week?.bonusEnabled);
  // Players only get here once it's turned on; admins can always open it to
  // preview.
  if (!week || (!live && !session.user.isAdmin)) redirect("/egg");

  const [myPlayers, guesses] = await Promise.all([
    prisma.player.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.bonusGuess.findMany({
      where: { weekId: week.id },
      include: { player: true },
    }),
  ]);
  const guessByPlayer = new Map(guesses.map((g) => [g.playerId, g]));

  const revealedAnswer =
    week.bonusRevealed && isBonusChoice(week.bonusAnswer) ? week.bonusAnswer : null;
  const winnerIds = new Set((await getBonusWinners([week.id])).get(week.id) ?? []);
  const winnerNames = guesses
    .filter((g) => winnerIds.has(g.playerId))
    .map((g) => g.player.name)
    .sort((a, b) => a.localeCompare(b));

  // Name guesses stay private until the answer is revealed; only then are they
  // sent to the page at all.
  const nameGuesses = revealedAnswer
    ? guesses
        .filter((g) => g.nameGuess)
        .map((g) => ({ playerName: g.player.name, name: g.nameGuess as string }))
        .sort((a, b) => a.playerName.localeCompare(b.playerName))
    : [];

  return (
    <BonusView
      weekNumber={week.weekNumber}
      players={myPlayers.map((p) => {
        const g = guessByPlayer.get(p.id);
        return {
          id: p.id,
          name: p.name,
          guess: isBonusChoice(g?.guess) ? g.guess : null,
          nameGuess: g?.nameGuess ?? "",
        };
      })}
      revealedAnswer={revealedAnswer}
      guessCount={guesses.length}
      winnerNames={winnerNames}
      nameGuesses={nameGuesses}
      previewNotLive={!live}
      heading={week.bonusHeading}
      blurb={week.bonusBlurb}
      hasImage={Boolean(week.bonusImageUrl)}
      hints={(week.bonusHints ?? "")
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean)}
    />
  );
}
