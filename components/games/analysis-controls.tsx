"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AnalysisStatus } from "@/types/saved-game";

const stages: Record<AnalysisStatus, string> = {
  PENDING: "Game saved. Ready for analysis.",
  ENGINE_RUNNING: "Stockfish is analyzing and saving move results.",
  ENGINE_COMPLETED: "Engine results saved. Coaching is available to run or retry.",
  AI_RUNNING: "Generating, validating, and saving coaching. Engine review is available below.",
  COMPLETED: "Analysis and coaching saved. Your review is ready.",
  FAILED: "Analysis stopped. Your game and saved move results are available below.",
};

export function AnalysisControls({ gameId, status, error, leaseUntil, coachingRevision = 0, autoStart = false }: {
  gameId: string; status: AnalysisStatus; error: string | null; leaseUntil: string | null; autoStart?: boolean; coachingRevision?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const submitted = useRef(false);
  const autoStarted = useRef(false);
  const running = status === "ENGINE_RUNNING" || status === "AI_RUNNING";
  const locked = running && Boolean(leaseUntil) && (now === 0 || Date.parse(leaseUntil!) >= now);
  const canRun = status !== "COMPLETED";
  const coaching = status === "ENGINE_COMPLETED" || status === "AI_RUNNING";

  const analyze = useCallback(async (regenerate = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/games/${gameId}/${regenerate ? "coaching" : "analyze"}`, regenerate ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: coachingRevision }) } : { method: "POST" });
      const body = await response.json();
      if (!response.ok) setMessage(body.error?.message ?? "Analysis failed. Please retry.");
      else if (body.coaching?.message) setMessage(body.coaching.message);
    } catch {
      setMessage("Connection lost. Refresh to check the saved analysis status before retrying.");
    } finally {
      submitted.current = false;
      setPending(false); router.refresh();
    }
  }, [gameId, router, coachingRevision]);

  useEffect(() => {
    if (!running && !pending) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [running, pending, router]);

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    const timer = setTimeout(() => {
      autoStarted.current = true;
      // Consume the import intent before starting; reloads never auto-retry failures.
      window.history.replaceState(window.history.state, "", `/games/${gameId}`);
      if (status === "PENDING") void analyze();
    }, 0);
    return () => clearTimeout(timer);
  }, [autoStart, gameId, status, analyze]);

  return <section className="mt-5 space-y-3" aria-label="Game analysis" aria-busy={pending || locked}>
    <p role="status">{stages[status]}</p>
    {error && <p className="text-red-800">{error}</p>}
    {running && <p className="text-sm">Status updates automatically. An interrupted run can be retried after its recovery window{leaseUntil ? ` (until ${leaseUntil.replace("T", " ").slice(0, 19)} UTC)` : ""}. The server checks whether recovery is safe.</p>}
    {canRun && <button onClick={() => void analyze()} disabled={pending || locked} className="rounded-lg bg-[#20382e] px-5 py-3 font-semibold text-white disabled:opacity-50">
      {pending ? "Analyzing…" : locked ? "Analysis in progress…" : status === "PENDING" ? "Analyze game" : coaching ? "Retry coaching" : "Retry analysis"}
    </button>}
    {status === "COMPLETED" && <div className="space-y-2">
      <p className="text-sm">Regenerate using the provider saved in <Link href="/settings" className="underline">Settings</Link>. This makes a new AI request. Current coaching stays available until a replacement succeeds; Stockfish results are reused.</p>
      <button onClick={() => void analyze(true)} disabled={pending} className="rounded-lg border border-[#20382e] px-5 py-3 font-semibold disabled:opacity-50">{pending ? "Generating coaching…" : "Regenerate coaching"}</button>
    </div>}
    <button onClick={() => router.refresh()} className="ml-4 underline">Refresh status</button>
    {pending && <p className="text-sm">Request in progress. Saved stages update automatically; you can review saved moves below.</p>}
    {message && <p role="alert" className="text-red-800">{message}</p>}
  </section>;
}
