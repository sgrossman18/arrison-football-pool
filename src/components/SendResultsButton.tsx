"use client";

import { useState, useTransition } from "react";
import { sendResultsEmail } from "@/app/admin/actions";

export default function SendResultsButton({
  weekId,
  weekNumber,
  sentAtText,
}: {
  weekId: string;
  weekNumber: number;
  sentAtText: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          const prompt = sentAtText
            ? `The Week ${weekNumber} results email already went out ${sentAtText}. Send it again to everyone?`
            : `Email the Week ${weekNumber} results and season standings to everyone now?`;
          if (!confirm(prompt)) return;
          startTransition(async () => {
            try {
              const result = await sendResultsEmail(weekId);
              setMessage(result.error ?? `Sent to ${result.sent} login${result.sent === 1 ? "" : "s"}.`);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Couldn't send.");
            }
          });
        }}
        className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50 transition-colors disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send results email now"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
