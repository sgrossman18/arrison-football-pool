"use client";

import { useEffect, useRef } from "react";

// Reports how long someone stayed on the rickroll page before leaving, via
// `pagehide` — the reliable event for "the user is actually gone" (tab
// closed, navigated away, or backgrounded into bfcache), unlike `unload`
// which modern browsers don't guarantee will fire. sendBeacon is used
// instead of fetch because the page may already be torn down by the time
// the request would go out; sendBeacon is designed to survive that.
export default function CheatStayTracker({ cheatClickId }: { cheatClickId: string }) {
  const startedAt = useRef<number | null>(null);
  const reported = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();

    const report = () => {
      if (startedAt.current == null) return;
      if (reported.current) return;
      reported.current = true;
      const seconds = (Date.now() - startedAt.current) / 1000;
      const blob = new Blob([JSON.stringify({ cheatClickId, seconds })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/cheat-duration", blob);
    };

    document.addEventListener("pagehide", report);
    return () => document.removeEventListener("pagehide", report);
  }, [cheatClickId]);

  return null;
}
