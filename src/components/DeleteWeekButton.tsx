"use client";

import { useTransition } from "react";
import { deleteWeek } from "@/app/admin/actions";

export default function DeleteWeekButton({
  weekId,
  weekNumber,
  gameCount,
  pickCount,
}: {
  weekId: string;
  weekNumber: number;
  gameCount: number;
  pickCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const detail =
          gameCount || pickCount
            ? ` This permanently deletes its ${gameCount} game${gameCount === 1 ? "" : "s"} and ${pickCount} submitted pick${pickCount === 1 ? "" : "s"}, and removes the week from results and standings.`
            : "";
        if (!confirm(`Delete Week ${weekNumber}?${detail} This can't be undone.`)) return;
        startTransition(async () => {
          await deleteWeek(weekId);
        });
      }}
      className="rounded-lg border-2 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 px-3.5 py-1.5 text-sm font-semibold hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors disabled:opacity-50"
    >
      {isPending ? "Deleting…" : `Delete Week ${weekNumber}`}
    </button>
  );
}
