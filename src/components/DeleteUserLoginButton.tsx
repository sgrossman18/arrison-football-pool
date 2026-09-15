"use client";

import { useState, useTransition } from "react";
import { deleteUserLogin } from "@/app/admin/actions";

export default function DeleteUserLoginButton({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Delete the login "${email}"? This can't be undone.`)) return;
          startTransition(async () => {
            const result = await deleteUserLogin(userId);
            if (!result.ok) setError(result.error ?? "Couldn't delete.");
          });
        }}
        className="text-xs font-medium rounded-lg border-2 border-border px-3 py-1.5 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete login"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
