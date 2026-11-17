"use client";

import { useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Image link for the bonus-point page. Paste a link, or upload a picture (it
// goes through the same admin-only upload as intro photos) and the link fills
// in; save the form to keep it.
export default function BonusImageField({ defaultValue }: { defaultValue: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("jpg, png, gif or webp only.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload-intro-image", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="url"
          name="imageUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Picture link (optional)"
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent flex-1 min-w-[16rem]"
        />
        <label className="text-sm font-semibold text-accent-strong cursor-pointer hover:underline">
          {busy ? "Uploading…" : "Upload a picture"}
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
}
