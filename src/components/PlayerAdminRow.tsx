"use client";

import { useState, useTransition } from "react";
import { renamePlayer, deletePlayer } from "@/app/admin/actions";

export default function PlayerAdminRow({
  player,
}: {
  player: { id: string; name: string };
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (removed) return null;

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setName(player.name);
              setEditing(false);
            }
          }}
          className="rounded-full border-2 border-accent px-2.5 py-1 text-xs font-medium outline-none w-24"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await renamePlayer(player.id, name);
              if (result.ok) {
                setEditing(false);
              } else {
                setError(result.error ?? "Couldn't rename.");
              }
            })
          }
          className="text-xs text-accent hover:underline font-medium disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setName(player.name);
            setEditing(false);
          }}
          className="text-xs text-muted hover:underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 pl-3 pr-1.5 py-1 text-xs font-medium">
      {player.name}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted hover:text-accent px-1"
        title="Rename"
      >
        ✎
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (
            !confirm(
              `Remove "${player.name}"? This deletes all of their picks for the whole season and can't be undone.`,
            )
          ) {
            return;
          }
          startTransition(async () => {
            await deletePlayer(player.id);
            setRemoved(true);
          });
        }}
        className="text-muted hover:text-red-600 px-1 disabled:opacity-50"
        title="Remove"
      >
        ✕
      </button>
    </span>
  );
}
