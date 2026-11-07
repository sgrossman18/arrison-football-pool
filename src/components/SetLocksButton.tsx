"use client";

import { useState, useTransition } from "react";
import { setLocksFromSchedule } from "@/app/admin/actions";

export default function SetLocksButton({ weekId }: { weekId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await setLocksFromSchedule(weekId);
            if (!r.ok) {
              setMessage(r.error);
              return;
            }
            const unmatched = r.total - r.matched;
            const early = r.early.length
              ? `Early locks: ${r.early.join("; ")}. Everything else locks at the week deadline.`
              : "No early locks needed — every game locks at the week deadline.";
            setMessage(
              unmatched > 0
                ? `${early} ${unmatched} game(s) weren't found on ESPN's schedule and were left as they were.`
                : early,
            );
          })
        }
        className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50 transition-colors disabled:opacity-60"
      >
        {isPending ? "Setting…" : "Set lock times from game schedule"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
