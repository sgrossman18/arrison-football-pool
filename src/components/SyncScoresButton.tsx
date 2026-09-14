"use client";

import { useState, useTransition } from "react";
import { syncScoresNow } from "@/app/admin/actions";

export default function SyncScoresButton() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await syncScoresNow();
            setMessage(
              result.errors.length
                ? `Updated ${result.updated}, errors: ${result.errors.join("; ")}`
                : `Updated ${result.updated} game(s).`,
            );
          })
        }
        className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:border-emerald-600 disabled:opacity-60"
      >
        {isPending ? "Syncing…" : "Sync scores now"}
      </button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </div>
  );
}
