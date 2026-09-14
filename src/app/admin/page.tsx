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
        <h1 className="text-2xl font-bold">Admin — {season.year} Season</h1>
        <div className="flex gap-2">
          <SyncScoresButton />
          <Link
            href="/admin/users"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:border-emerald-600"
          >
            Manage participants
          </Link>
          <form action={createNextWeek}>
            <button
              type="submit"
              className="rounded-md bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800"
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
            className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 flex items-center justify-between hover:border-emerald-600"
          >
            <span className="font-medium">Week {w.weekNumber}</span>
            <span className="text-sm text-neutral-500">
              {w.games.length} game{w.games.length === 1 ? "" : "s"} set up
            </span>
          </Link>
        ))}
        {weeks.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">
            No weeks yet — create the first one above.
          </p>
        )}
      </div>
    </div>
  );
}
