import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentSeason } from "@/lib/season";
import { createNextWeek } from "./actions";
import SyncScoresButton from "@/components/SyncScoresButton";

export default async function AdminDashboard() {
  await requireAdmin();

  const season = await getOrCreateCurrentSeason();
  const weeks = await prisma.week.findMany({
    where: { seasonId: season.id },
    orderBy: { weekNumber: "desc" },
    include: { games: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Admin <span className="text-muted font-medium">— {season.year} Season</span>
        </h1>
        <div className="flex gap-2 flex-wrap">
          <SyncScoresButton />
          <Link
            href="/admin/users"
            className="rounded-lg border-2 border-border px-4 py-2 text-sm font-medium hover:border-accent/50 transition-colors"
          >
            Manage participants
          </Link>
          <form action={createNextWeek}>
            <button
              type="submit"
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold hover:bg-accent-strong transition-colors shadow-sm"
            >
              + Create Week {(weeks[0]?.weekNumber ?? 0) + 1}
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {weeks.map((w) => (
          <Link
            key={w.id}
            href={`/admin/weeks/${w.id}`}
            className="rounded-2xl border border-border bg-surface shadow-sm p-4 flex items-center justify-between hover:border-accent/50 transition-colors"
          >
            <span className="font-semibold">Week {w.weekNumber}</span>
            <span className="text-sm text-muted">
              {w.games.length} game{w.games.length === 1 ? "" : "s"} set up
            </span>
          </Link>
        ))}
        {weeks.length === 0 && (
          <p className="text-muted">No weeks yet — create the first one above.</p>
        )}
      </div>
    </div>
  );
}
