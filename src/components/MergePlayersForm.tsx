"use client";

import { useState, useTransition } from "react";
import { mergePlayers } from "@/app/admin/actions";

export type MergeCandidate = { id: string; label: string };

export default function MergePlayersForm({ players }: { players: MergeCandidate[] }) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!sourceId || !targetId) {
      setError("Pick both a duplicate and the account to keep.");
      return;
    }
    if (sourceId === targetId) {
      setError("Pick two different picker profiles.");
      return;
    }
    const sourceLabel = players.find((p) => p.id === sourceId)?.label ?? "this profile";
    const targetLabel = players.find((p) => p.id === targetId)?.label ?? "the other profile";
    if (
      !confirm(
        `Move all of ${sourceLabel}'s picks into ${targetLabel}, then delete ${sourceLabel}? This can't be undone.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await mergePlayers(sourceId, targetId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't merge.");
        return;
      }
      setMessage(
        `Moved ${result.movedPicks} pick${result.movedPicks === 1 ? "" : "s"}` +
          (result.skippedPicks
            ? ` (${result.skippedPicks} duplicate pick${result.skippedPicks === 1 ? "" : "s"} for the same game kept from the account you're keeping).`
            : ".") +
          ` "${sourceLabel}" has been removed.`,
      );
      setSourceId("");
      setTargetId("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
          <option value="">Duplicate to remove...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">merges into</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        >
          <option value="">Account to keep...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border-2 border-accent text-accent px-3.5 py-1.5 text-sm font-semibold hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
        >
          {isPending ? "Merging…" : "Merge"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      {message && <p className="text-xs text-accent-strong font-medium">{message}</p>}
    </form>
  );
}
