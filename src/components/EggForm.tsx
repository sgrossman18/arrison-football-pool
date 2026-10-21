"use client";

import { useState, useTransition } from "react";
import { submitEgg } from "@/app/egg/actions";

export default function EggForm() {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSent(false);
        startTransition(async () => {
          const result = await submitEgg(text);
          if (result.ok) {
            setText("");
            setSent(true);
          } else {
            setError(result.error ?? "Something went wrong. Try again.");
          }
        });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSent(false);
        }}
        rows={4}
        maxLength={1000}
        placeholder="What did you find?"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="rounded-full bg-accent text-white px-6 py-2.5 font-semibold shadow-md shadow-accent/20 hover:bg-accent-strong transition-colors disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Submit egg"}
        </button>
        {sent && <span className="text-sm text-accent-strong font-medium">Egg submitted! 🥚</span>}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </form>
  );
}
