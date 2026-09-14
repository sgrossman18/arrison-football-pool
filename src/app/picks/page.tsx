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
      <div className="rounded-2xl border border-border bg-surface shadow-sm p-6 text-muted">
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

      <h1 className="text-3xl font-extrabold tracking-tight mb-1 mt-3">
        Week {week.weekNumber}
        {players.length > 1 && (
          <span className="text-muted font-medium"> — {activePlayer.name}&apos;s picks</span>
        )}
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
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium border-2 transition-colors ${
            p.id === activePlayerId
              ? "bg-accent border-accent text-white shadow-sm"
              : "border-border text-foreground hover:border-accent/50"
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
      <summary className="cursor-pointer text-accent hover:text-accent-strong inline font-medium">
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
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg border-2 border-accent text-accent px-3 py-1.5 text-sm font-semibold hover:bg-accent hover:text-white transition-colors"
        >
          Add
        </button>
      </form>
    </details>
  );
}

function FirstPlayerPrompt({ defaultName }: { defaultName?: string | null }) {
  return (
    <div className="max-w-sm mx-auto py-12 sm:py-20">
      <div className="rounded-2xl border border-border bg-surface shadow-sm p-7">
        <h1 className="text-2xl font-bold mb-2">Welcome! 🏈</h1>
        <p className="text-muted mb-6 text-sm">
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
            className="rounded-lg border border-border bg-background px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent text-white px-4 py-2.5 font-semibold hover:bg-accent-strong transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
