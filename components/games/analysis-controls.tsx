"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisStatus } from "@/types/saved-game";

export function AnalysisControls({ gameId, status, error, leaseUntil }: {
  gameId: string; status: AnalysisStatus; error: string | null; leaseUntil: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canRun = status === "PENDING" || status === "FAILED" || status === "ENGINE_RUNNING";
  async function analyze() {
    if (pending) return;
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/games/${gameId}/analyze`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) setMessage(body.error?.message ?? "Analysis failed. Please retry.");
    } catch {
      setMessage("Connection lost. Refresh to check the saved analysis status before retrying.");
    } finally {
      setPending(false); router.refresh();
    }
  }
  return <section className="mt-5 space-y-3" aria-label="Engine analysis" aria-busy={pending}>
    <p>Analysis: {pending ? "engine running" : status.toLowerCase().replaceAll("_", " ")}</p>
    {error && <p className="text-red-800">{error}</p>}
    {status === "ENGINE_RUNNING" && <p className="text-sm">Analysis may still be running. An interrupted run can be retried after its recovery window{leaseUntil ? ` (until ${leaseUntil.replace("T", " ").slice(0, 19)} UTC)` : ""}.</p>}
    {canRun && <button onClick={analyze} disabled={pending} className="rounded-lg bg-[#20382e] px-5 py-3 font-semibold text-white disabled:opacity-50">
      {pending ? "Analyzing…" : status === "PENDING" ? "Analyze game" : "Retry analysis"}
    </button>}
    <button onClick={() => router.refresh()} disabled={pending} className="ml-4 underline">Refresh status</button>
    {pending && <p role="status">Analyzing your game. This may take a few minutes.</p>}
    {message && <p role="alert" className="text-red-800">{message}</p>}
  </section>;
}
