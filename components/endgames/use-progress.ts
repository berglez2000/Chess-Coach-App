"use client";
import { useEffect, useRef, useState } from "react";
import type { EndgameProgress, EndgameSnapshot } from "@/lib/endgames/progress";
export function useEndgameProgress(positionId: string | undefined, initial: EndgameProgress | undefined, snapshot: EndgameSnapshot | null) {
  const [progress, setProgress] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial?.snapshot ?? null));
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const revision = useRef(initial?.revision ?? 0);
  const pending = useRef<{ requestId: string; expectedRevision: number; snapshot: EndgameSnapshot } | null>(null);
  const value = JSON.stringify(snapshot);
  const enabled = !!positionId && !!initial;
  const ready = !enabled || (!error && saved === value);
  useEffect(() => {
    if (!enabled || !snapshot || saved === value) return;
    let active = true;
    const input = pending.current ?? { requestId: crypto.randomUUID(), expectedRevision: revision.current, snapshot };
    pending.current = input;
    async function save() {
      try {
        const response = await fetch(`/api/endgames/${positionId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), keepalive: true });
        const data = await response.json();
        if (!response.ok) throw new Error(response.status === 409 ? "Practice changed in another tab. Reload to continue from the saved game." : data.error?.message ?? "Practice could not be saved. Retry to continue.");
        if (!active) return;
        revision.current = data.progress.revision; pending.current = null;
        setProgress(data.progress); setSaved(value); setError("");
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Practice could not be saved."); }
    }
    void save();
    return () => { active = false; };
    // Snapshot changes are represented by value; retries retain the exact request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, positionId, value, saved, retry]);
  useEffect(() => {
    if (!enabled || ready) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [enabled, ready]);
  return { ready, error, progress, retry: () => { setError(""); setRetry(number => number + 1); }, enabled };
}
