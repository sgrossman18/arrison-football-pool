"use client";

import { useRef, useState, useTransition } from "react";
import { updateIntro } from "@/app/admin/actions";
import WeekIntro from "@/components/WeekIntro";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

export default function IntroEditor({
  weekId,
  initialMarkdown,
}: {
  weekId: string;
  initialMarkdown: string;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function uploadImage(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("That's not an image file (jpg, png, gif, and webp only).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is too big — ${Math.round(file.size / 1024 / 1024)}MB, 4MB max.`);
      return;
    }

    setIsUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      // A hard timeout so a flaky upload fails loudly instead of leaving
      // the button stuck on "Uploading..." forever with no explanation.
      const res = await fetch("/api/upload-intro-image", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      // Insert at the cursor if the textarea has focus, otherwise append —
      // either way as its own line so it renders as an embedded image
      // rather than inline text.
      const insert = `\n![](${data.url})\n`;
      const el = textareaRef.current;
      setMarkdown((prev) => {
        if (el && document.activeElement === el) {
          const pos = el.selectionStart ?? prev.length;
          return prev.slice(0, pos) + insert + prev.slice(pos);
        }
        return prev + (prev.endsWith("\n") || !prev ? "" : "\n") + insert.trimStart();
      });
      setSaved(false);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "Upload timed out — try again."
          : e instanceof Error
            ? e.message
            : "Upload failed — try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Write whatever intro/trash talk you want. Drop in a photo below, or paste an
        image/GIF link on its own line to embed it (works great with Giphy/Tenor links too).
      </p>

      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={(e) => {
          setMarkdown(e.target.value);
          setSaved(false);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void uploadImage(file);
        }}
        rows={8}
        className={`rounded-lg border bg-background px-2.5 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors ${
          isDragging ? "border-accent border-2 bg-accent-soft" : "border-border"
        }`}
        placeholder="This week's intro... (or just drag a photo in here)"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50 transition-colors disabled:opacity-60"
        >
          {isUploading ? "Uploading…" : "📷 Add a photo"}
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={() =>
            startSaving(async () => {
              await updateIntro(weekId, markdown);
              setSaved(true);
            })
          }
          className="rounded-lg bg-accent text-white px-3.5 py-1.5 text-sm font-semibold hover:bg-accent-strong transition-colors shadow-sm disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save intro"}
        </button>

        {saved && <span className="text-xs text-accent-strong font-medium">Saved!</span>}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}

      {markdown.trim() && (
        <div>
          <p className="text-xs text-muted mb-2 font-medium">Preview:</p>
          <WeekIntro markdown={markdown} />
        </div>
      )}
    </div>
  );
}
