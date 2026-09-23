"use client";

import { useState, useTransition } from "react";
import { sortWeekByGameTime } from "@/app/admin/actions";

export default function SortGamesButton({ weekId }: { weekId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await sortWeekByGameTime(weekId);
            if (!r.ok) {
              setMessage(r.error ?? "Couldn't sort.");
            } else if (r.matched === r.total) {
              setMessage("Sorted by game time.");
            } else {
              setMessage(
                `Sorted by game time — ${r.total! - r.matched!} game(s) weren't found on ESPN's schedule and were left at the end.`,
              );
            }
          })
        }
        className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50 transition-colors disabled:opacity-60"
      >
        {isPending ? "Sorting…" : "Sort by game time"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
