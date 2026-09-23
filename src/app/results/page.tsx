import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { isWeekLocked } from "@/lib/locking";
import { gameOutcome, pickPoints, computeWeekScores } from "@/lib/scoring";
import { NFL_TEAMS, teamName } from "@/lib/teams";
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
    return <div className="text-muted">No weeks yet.</div>;
  }

  const { week: weekParam } = await searchParams;
  const selectedWeekNumber = weekParam ? Number(weekParam) : weeks[0].weekNumber;

  const week = await prisma.week.findUnique({
    where: { seasonId_weekNumber: { seasonId: season.id, weekNumber: selectedWeekNumber } },
    include: {
      games: { orderBy: [{ sortOrder: "asc" }, { kickoff: "asc" }] },
      lockOverrides: true,
      season: true,
    },
  });

  if (!week) {
    return <div className="text-muted">Week not found.</div>;
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
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Week {week.weekNumber} Results</h1>
        <div className="flex gap-1.5 flex-wrap">
          {weeks.map((w) => (
            <Link
              key={w.id}
              href={`/results?week=${w.weekNumber}`}
              className={`rounded-full px-3 py-1 text-sm font-medium border-2 transition-colors ${
                w.weekNumber === selectedWeekNumber
                  ? "bg-accent border-accent text-white"
                  : "border-border text-foreground hover:border-accent/50"
              }`}
            >
              Wk {w.weekNumber}
            </Link>
          ))}
        </div>
      </div>

      {!locked && (
        <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm font-medium mb-4">
          Picks aren&apos;t locked yet — other people&apos;s picks are hidden until they are.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left bg-surface-2">
                <th className="py-3 pl-4 pr-3 font-semibold">Player</th>
                {week.games.map((g) => {
                  const outcome = gameOutcome(g);
                  return (
                    <th key={g.id} className="py-3 px-2 font-medium text-xs min-w-[92px]">
                      <div className="flex items-center gap-1">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: NFL_TEAMS[g.awayTeam]?.color }}
                        />
                        {g.awayTeam}
                        <span className="text-muted">@</span>
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: NFL_TEAMS[g.homeTeam]?.color }}
                        />
                        {g.homeTeam}
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {outcome
                          ? `${g.awayScore}-${g.homeScore}`
                          : g.status === "IN_PROGRESS"
                            ? <span className="text-accent">Live</span>
                            : ""}
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 pl-3 pr-4 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ player, total, complete }, i) => {
                const isMe = player.ownerUserId === session.user.id;
                const visible = locked || isMe;
                return (
                  <tr
                    key={player.id}
                    className={`border-t border-border ${isMe ? "bg-accent-soft" : i % 2 === 1 ? "bg-surface-2/50" : ""}`}
                  >
                    <td className="py-2.5 pl-4 pr-3 font-medium whitespace-nowrap">
                      {player.name}
                      {isMe && <span className="text-accent"> · you</span>}
                    </td>
                    {week.games.map((g) => {
                      const pick = picks.find(
                        (p) => p.playerId === player.id && p.gameId === g.id,
                      );
                      if (!pick)
                        return (
                          <td key={g.id} className="py-2.5 px-2 text-muted">
                            —
                          </td>
                        );
                      if (!visible) {
                        return (
                          <td key={g.id} className="py-2.5 px-2 text-muted italic text-xs">
                            hidden
                          </td>
                        );
                      }
                      const earned = pickPoints(
                        {
                          playerId: pick.playerId,
                          gameId: pick.gameId,
                          pickedTeam: pick.pickedTeam,
                          confidence: pick.confidence,
                        },
                        g,
                      );
                      const color = NFL_TEAMS[pick.pickedTeam]?.color ?? "#525252";
                      const state = earned === null ? "pending" : earned > 0 ? "correct" : "wrong";
                      return (
                        <td key={g.id} className="py-2.5 px-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              state === "wrong"
                                ? "opacity-50 line-through"
                                : state === "pending"
                                  ? "opacity-70"
                                  : ""
                            }`}
                            style={
                              state === "correct"
                                ? {
                                    backgroundColor: color,
                                    color: "#fff",
                                    // Some team colors are near-black/near-white and would
                                    // otherwise vanish against the page background.
                                    boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.4)",
                                  }
                                : { border: `1.5px solid ${color}` }
                            }
                          >
                            {teamName(pick.pickedTeam)} ({pick.confidence})
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 pr-4 text-right font-bold">
                      {visible ? total : "—"}
                      {visible && !complete && <span className="text-muted font-normal">*</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted mt-2">* Some games this week are still in progress.</p>
    </div>
  );
}
