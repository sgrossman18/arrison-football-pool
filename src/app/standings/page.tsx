import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { computeSeasonStandings } from "@/lib/scoring";
import { maybeSyncActiveWeeks } from "@/lib/sync-scores";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function StandingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  await maybeSyncActiveWeeks();

  const season = await getOrCreateCurrentSeason();
  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "asc" },
    include: { games: true },
  });

  if (weeks.length === 0) {
    return <div className="text-muted">No weeks yet.</div>;
  }

  const picks = await prisma.pick.findMany({
    where: { gameId: { in: weeks.flatMap((w) => w.games.map((g) => g.id)) } },
  });
  const playerIds = [...new Set(picks.map((p) => p.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } } });
  const playerById = new Map(players.map((p) => [p.id, p]));

  const standings = computeSeasonStandings(
    weeks.map((w) => ({
      weekNumber: w.weekNumber,
      games: w.games,
      picks: picks
        .filter((p) => w.games.some((g) => g.id === p.gameId))
        .map((p) => ({
          playerId: p.playerId,
          gameId: p.gameId,
          pickedTeam: p.pickedTeam,
          confidence: p.confidence,
        })),
    })),
    playerIds,
  ).sort((a, b) => b.bestTotal - a.bestTotal || b.seasonTotal - a.seasonTotal);

  const showDrop = standings.some((s) => s.droppedWeeks.length > 0);

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-5">
        {season.year} Season Standings
      </h1>
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left bg-surface-2">
                <th className="py-3 pl-4 pr-2 font-semibold w-10">#</th>
                <th className="py-3 pr-3 font-semibold">Player</th>
                {weeks.map((w) => (
                  <th key={w.id} className="py-3 px-2 text-xs font-medium">
                    Wk{w.weekNumber}
                  </th>
                ))}
                <th className="py-3 px-3 text-right font-semibold">Total</th>
                {showDrop && (
                  <th className="py-3 pl-3 pr-4 text-right font-semibold">Best (drop 3)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const player = playerById.get(s.playerId);
                const isMe = player?.ownerUserId === session.user.id;
                return (
                  <tr
                    key={s.playerId}
                    className={`border-t border-border ${
                      isMe ? "bg-accent-soft" : i % 2 === 1 ? "bg-surface-2/50" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-4 pr-2 font-semibold text-muted">
                      {MEDALS[i] ?? i + 1}
                    </td>
                    <td className="py-2.5 pr-3 font-medium whitespace-nowrap">
                      {player?.name ?? "?"}
                      {isMe && <span className="text-accent"> · you</span>}
                    </td>
                    {s.weeklyTotals.map((w) => (
                      <td
                        key={w.weekNumber}
                        className={`py-2.5 px-2 ${
                          s.droppedWeeks.includes(w.weekNumber)
                            ? "text-muted line-through"
                            : ""
                        }`}
                      >
                        {w.complete ? w.points : w.points || "-"}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-semibold">{s.seasonTotal}</td>
                    {showDrop && (
                      <td className="py-2.5 pl-3 pr-4 text-right font-bold text-accent-strong">
                        {s.bestTotal}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {showDrop && (
        <p className="text-xs text-muted mt-2">
          Struck-through weeks are each player&apos;s 3 lowest scores, dropped from
          their &quot;Best&quot; total.
        </p>
      )}
    </div>
  );
}
