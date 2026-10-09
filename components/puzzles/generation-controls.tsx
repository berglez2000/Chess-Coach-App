"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Summary = { status: string; error: string | null; count: number; checkedCandidates: number; leaseUntil: string | null } | null;
export function PuzzleGenerationControls({ gameId, ready, generation }: { gameId: string; ready: boolean; generation: Summary }) {
  const router = useRouter();
  const submitted = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const running = generation?.status === "RUNNING";
  const locked = running && (now === 0 || !generation.leaseUntil || Date.parse(generation.leaseUntil) > now);
  const complete = generation?.status === "COMPLETED";
  useEffect(() => {
    if (!running && !pending) return;
    const timer = setInterval(() => { setNow(Date.now()); router.refresh(); }, 3000);
    return () => clearInterval(timer);
  }, [running, pending, router]);
  async function generate() {
    if (submitted.current) return;
    submitted.current = true;
    setPending(true); setMessage(null);
    try {
      const response = await fetch(`/api/games/${gameId}/puzzles`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) setMessage(body.error?.message ?? "Could not generate puzzles. Please retry.");
    } catch { setMessage("Connection lost. Refresh status to check whether your puzzles were saved before retrying."); }
    finally { submitted.current = false; setPending(false); router.refresh(); }
  }
  return <section aria-label="Puzzles from this game" aria-busy={pending || locked} className="mt-6 rounded-2xl border border-[#20382e]/15 bg-white p-5">
    <h2 className="font-semibold">Puzzles from this game</h2>
    <p className="mt-2 text-sm text-[#465c50]">Turn up to five of your biggest mistakes into tactical puzzles with up to three of your moves and automatic opponent replies. Stockfish validates each continuation; some puzzles end after one move, and some games have no suitable positions.</p>
    {complete ? <><p role="status" className="mt-3 text-sm">{generation.count ? `${generation.count} ${generation.count === 1 ? "puzzle" : "puzzles"} saved for practice.` : "No suitable puzzles found among the checked mistakes. Your review is still available."}</p>{generation.count > 0 && <Link href={`/puzzles?game=${gameId}`} className="mt-3 inline-block font-semibold underline">Practice these puzzles →</Link>}{generation.count > 0 && <Link href={`/replay?game=${gameId}`} className="ml-4 mt-3 inline-block font-semibold underline">Beat your past self →</Link>}</> : <>
      {!ready && <p className="mt-3 text-sm">Complete engine analysis to generate puzzles. AI coaching is optional.</p>}
      <button type="button" onClick={() => void generate()} disabled={!ready || pending || locked} className="mt-3 rounded-lg bg-[#20382e] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending || locked ? "Checking puzzle candidates…" : generation?.status === "FAILED" || running ? "Retry puzzle generation" : "Generate puzzles"}</button>
    </>}
    {running && <p role="status" className="mt-2 text-sm">Status updates automatically. Interrupted generation can be retried five minutes after its last saved activity.</p>}
    {(message || generation?.error) && <p role="alert" className="mt-3 text-sm text-red-800">{message ?? generation?.error}</p>}
    {generation && !complete && <button type="button" onClick={() => router.refresh()} className="ml-3 text-sm underline">Refresh puzzle status</button>}
  </section>;
}
