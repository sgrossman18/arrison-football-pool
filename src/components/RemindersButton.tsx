"use client";

import { useState, useTransition } from "react";
import { sendPickReminders } from "@/app/admin/actions";

export default function RemindersButton({ weekId }: { weekId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendPickReminders(weekId);
            setMessage(
              result.error
                ? result.error
                : result.sent === 0
                  ? "Everyone's already submitted — no reminders needed."
                  : `Sent ${result.sent} reminder email${result.sent === 1 ? "" : "s"}.`,
            );
          })
        }
        className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50 transition-colors disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send reminder emails"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
