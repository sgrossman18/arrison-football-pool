import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { isWeekLocked } from "@/lib/locking";
import { gameOutcome, pickPoints, computeWeekScores } from "@/lib/scoring";
import { teamName } from "@/lib/teams";
import { maybeSyncActiveWeeks } from "@/lib/sync-scores";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  await maybeSyncActiveWeeks();

  const season = await getOrCreateCurrentSeason();
  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "desc" },
    select: { id: true, weekNumber: true },
  });

  if (weeks.length === 0) {
    return <div className="text-neutral-600 dark:text-neutral-400">No weeks yet.</div>;
  }

  const { week: weekParam } = await searchParams;
  const selectedWeekNumber = weekParam ? Number(weekParam) : weeks[0].weekNumber;

  const week = await prisma.week.findUnique({
    where: { seasonId_weekNumber: { seasonId: season.id, weekNumber: selectedWeekNumber } },
    include: {
      games: { orderBy: { kickoff: "asc" } },
      lockOverrides: true,
      season: true,
    },
  });

  if (!week) {
    return <div className="text-neutral-600 dark:text-neutral-400">Week not found.</div>;
  }

  const picks = await prisma.pick.findMany({
    where: { gameId: { in: week.games.map((g) => g.id) } },
    include: { player: true },
  });

  const locked = isWeekLocked({
    locksAt: week.locksAt,
    gameKickoffs: week.games.map((g) => g.kickoff),
  });

  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const scores = computeWeekScores(
    week.games,
    picks.map((p) => ({
      playerId: p.playerId,
      gameId: p.gameId,
      pickedTeam: p.pickedTeam,
      confidence: p.confidence,
    })),
  );

  const rows = players
    .map((pl) => ({
      player: pl,
      total: scores.get(pl.id)?.points ?? 0,
      complete: scores.get(pl.id)?.complete ?? false,
    }))
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-2xl font-bold">Week {week.weekNumber} Results</h1>
        <div className="flex gap-2 flex-wrap">
          {weeks.map((w) => (
            <Link
              key={w.id}
              href={`/results?week=${w.weekNumber}`}
              className={`rounded-md px-3 py-1 text-sm border ${
                w.weekNumber === selectedWeekNumber
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "border-neutral-300 dark:border-neutral-700 hover:border-emerald-600"
              }`}
            >
              Wk {w.weekNumber}
            </Link>
          ))}
        </div>
      </div>

      {!locked && (
        <div className="rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm mb-4">
          Picks aren&apos;t locked yet — other people&apos;s picks are hidden until they are.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-neutral-200 dark:border-neutral-800">
              <th className="py-2 pr-3">Player</th>
              {week.games.map((g) => (
                <th key={g.id} className="py-2 px-2 font-medium text-xs">
                  {g.awayTeam} @ {g.homeTeam}
                  <div className="font-normal text-neutral-500">
                    {gameOutcome(g)
                      ? `${g.awayScore}-${g.homeScore}`
                      : g.status === "IN_PROGRESS"
                        ? "Live"
                        : ""}
                  </div>
                </th>
              ))}
              <th className="py-2 pl-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, total, complete }) => {
              const isMe = player.ownerUserId === session.user.id;
              const visible = locked || isMe;
              return (
                <tr
                  key={player.id}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">
                    {player.name}
                    {isMe && <span className="text-emerald-600"> (you)</span>}
                  </td>
                  {week.games.map((g) => {
                    const pick = picks.find(
                      (p) => p.playerId === player.id && p.gameId === g.id,
                    );
                    if (!pick) return <td key={g.id} className="py-2 px-2 text-neutral-400">—</td>;
                    if (!visible) {
                      return (
                        <td key={g.id} className="py-2 px-2 text-neutral-400">
                          hidden
                        </td>
                      );
                    }
                    const earned = pickPoints(
                      { playerId: pick.playerId, gameId: pick.gameId, pickedTeam: pick.pickedTeam, confidence: pick.confidence },
                      g,
                    );
                    const color =
                      earned === null
                        ? "text-neutral-500"
                        : earned > 0
                          ? "text-emerald-600 font-semibold"
                          : "text-red-500";
                    return (
                      <td key={g.id} className={`py-2 px-2 ${color}`}>
                        {teamName(pick.pickedTeam)} ({pick.confidence})
                      </td>
                    );
                  })}
                  <td className="py-2 pl-3 text-right font-semibold">
                    {visible ? total : "—"}
                    {visible && !complete && (
                      <span className="text-neutral-400 font-normal">*</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-500 mt-2">* Some games this week are still in progress.</p>
    </div>
  );
}
