import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentWeek } from "@/lib/season";
import { prisma } from "@/lib/db";
import {
  canSubmitPicks,
  effectiveLockTime,
  hasActiveOverride,
  isWeekLocked,
} from "@/lib/locking";
import { formatEastern } from "@/lib/timezone";
import WeekIntro from "@/components/WeekIntro";
import PicksForm from "@/components/PicksForm";
import { submitPicks } from "./actions";
import { createPlayer } from "./player-actions";

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const players = await prisma.player.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  if (players.length === 0) {
    return <FirstPlayerPrompt defaultName={session.user.name} />;
  }

  const { player: playerParam } = await searchParams;
  const activePlayer = players.find((p) => p.id === playerParam) ?? players[0];

  const week = await getCurrentWeek();

  if (!week || week.games.length === 0) {
    return (
      <div className="text-neutral-600 dark:text-neutral-400">
        No games have been set up for this week yet. Check back soon!
      </div>
    );
  }

  const existingPicks = await prisma.pick.findMany({
    where: { playerId: activePlayer.id, gameId: { in: week.games.map((g) => g.id) } },
  });

  const weekLockInfo = {
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  };
  const overrides = week.lockOverrides.map((o) => ({
    playerId: o.playerId,
    expiresAt: o.expiresAt,
  }));
  const allowed = canSubmitPicks(weekLockInfo, overrides, activePlayer.id);
  const lockTime = effectiveLockTime(weekLockInfo);
  const locked = isWeekLocked(weekLockInfo);
  const overridden = locked && hasActiveOverride(overrides, activePlayer.id);

  const lockMessage = overridden
    ? "This week is normally locked, but you've been given an exception — go ahead and submit."
    : locked && lockTime
      ? `Picks locked at ${formatEastern(lockTime)}.`
      : undefined;

  return (
    <div>
      {players.length > 1 && (
        <PlayerTabs players={players} activePlayerId={activePlayer.id} />
      )}
      <AddPlayerLink />

      <h1 className="text-2xl font-bold mb-1 mt-3">
        Week {week.weekNumber}
        {players.length > 1 ? ` — ${activePlayer.name}'s picks` : ""}
      </h1>
      <WeekIntro markdown={week.introMarkdown} />

      <PicksForm
        key={activePlayer.id}
        games={week.games.map((g) => ({
          id: g.id,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          kickoff: g.kickoff.toISOString(),
        }))}
        initialPicks={existingPicks.map((p) => ({
          gameId: p.gameId,
          pickedTeam: p.pickedTeam,
          confidence: p.confidence,
        }))}
        canSubmit={allowed}
        lockMessage={lockMessage}
        submitAction={submitPicks.bind(null, week.id, activePlayer.id)}
      />
    </div>
  );
}

function PlayerTabs({
  players,
  activePlayerId,
}: {
  players: { id: string; name: string }[];
  activePlayerId: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {players.map((p) => (
        <Link
          key={p.id}
          href={`/picks?player=${p.id}`}
          className={`rounded-md px-3 py-1.5 text-sm border ${
            p.id === activePlayerId
              ? "bg-emerald-700 border-emerald-700 text-white"
              : "border-neutral-300 dark:border-neutral-700 hover:border-emerald-600"
          }`}
        >
          {p.name}
        </Link>
      ))}
    </div>
  );
}

function AddPlayerLink() {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-emerald-700 dark:text-emerald-400 inline">
        + Add someone else I&apos;m picking for
      </summary>
      <form
        action={async (formData: FormData) => {
          "use server";
          const name = String(formData.get("name") || "");
          const result = await createPlayer(name);
          if (result.ok && result.playerId) {
            redirect(`/picks?player=${result.playerId}`);
          }
        }}
        className="flex items-center gap-2 mt-2"
      >
        <input
          type="text"
          name="name"
          required
          placeholder="e.g. Aria"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-emerald-700 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 hover:text-white"
        >
          Add
        </button>
      </form>
    </details>
  );
}

function FirstPlayerPrompt({ defaultName }: { defaultName?: string | null }) {
  return (
    <div className="max-w-sm mx-auto py-16">
      <h1 className="text-2xl font-bold mb-2">Welcome! 🏈</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6 text-sm">
        What&apos;s your name? If you&apos;ll also be picking for family
        members without their own email, you can add them next.
      </p>
      <form
        action={async (formData: FormData) => {
          "use server";
          const name = String(formData.get("name") || "");
          const result = await createPlayer(name);
          if (result.ok && result.playerId) {
            redirect(`/picks?player=${result.playerId}`);
          }
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName ?? ""}
          placeholder="Your name"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-700 text-white px-4 py-2 font-medium hover:bg-emerald-800"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
