import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSeasonWeeks, pickCurrentWeek } from "@/lib/season";
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
  searchParams: Promise<{ player?: string; week?: string }>;
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

  const { player: playerParam, week: weekParam } = await searchParams;
  const activePlayer = players.find((p) => p.id === playerParam) ?? players[0];

  const allWeeks = await getSeasonWeeks();
  const browsableWeeks = allWeeks.filter((w) => w.games.length > 0);
  const currentWeek = pickCurrentWeek(allWeeks);
  const week =
    browsableWeeks.find((w) => String(w.weekNumber) === weekParam) ?? currentWeek;

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

  const openDeadlineNote =
    allowed && !locked && lockTime
      ? `You can change these picks as many times as you want until ${formatEastern(lockTime)}.`
      : undefined;

  return (
    <div>
      {players.length > 1 && (
        <PlayerTabs
          players={players}
          activePlayerId={activePlayer.id}
          weekNumber={week.weekNumber}
        />
      )}
      <AddPlayerLink />

      {browsableWeeks.length > 1 && (
        <WeekTabs
          weeks={browsableWeeks.map((w) => w.weekNumber)}
          activeWeek={week.weekNumber}
          currentWeek={currentWeek?.weekNumber}
          playerId={players.length > 1 ? activePlayer.id : undefined}
        />
      )}

      <h1 className="text-3xl font-extrabold tracking-tight mb-1 mt-3">
        Week {week.weekNumber}
        {players.length > 1 && (
          <span className="text-muted font-medium"> — {activePlayer.name}&apos;s picks</span>
        )}
      </h1>
      <WeekIntro markdown={week.introMarkdown} />
      {openDeadlineNote && <p className="text-sm text-muted mb-4">{openDeadlineNote}</p>}

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

function WeekTabs({
  weeks,
  activeWeek,
  currentWeek,
  playerId,
}: {
  weeks: number[];
  activeWeek: number;
  currentWeek?: number;
  playerId?: string;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-3">
      {weeks.map((n) => (
        <Link
          key={n}
          href={`/picks?week=${n}${playerId ? `&player=${playerId}` : ""}`}
          className={`rounded-full px-3 py-1 text-sm font-medium border-2 transition-colors ${
            n === activeWeek
              ? "bg-accent border-accent text-white"
              : "border-border text-foreground hover:border-accent/50"
          }`}
        >
          Wk {n}
          {n === currentWeek && <span className="opacity-70 text-xs"> · current</span>}
        </Link>
      ))}
    </div>
  );
}

function PlayerTabs({
  players,
  activePlayerId,
  weekNumber,
}: {
  players: { id: string; name: string }[];
  activePlayerId: string;
  weekNumber: number;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {players.map((p) => (
        <Link
          key={p.id}
          href={`/picks?week=${weekNumber}&player=${p.id}`}
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
