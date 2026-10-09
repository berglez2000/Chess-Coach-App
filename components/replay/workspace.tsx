"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { PuzzleSolver } from "@/components/puzzles/puzzle-solver";
import { ReplayBoard } from "@/components/chess/replay-board";
import { StartReplay } from "./start";
import type { ReplayAction, ReplayDto } from "@/lib/replay/contract";

export function ReplayWorkspace({ initialSession }: { initialSession: ReplayDto }) {
  const [session, setSession] = useState(initialSession);
  const [solverBusy, setSolverBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [retry, setRetry] = useState<ReplayAction | null>(null);
  const submitted = useRef(false);
  const [inspectOriginal, setInspectOriginal] = useState(false);
  function onResponse(body: unknown) {
    const saved = (body as { session?: ReplayDto }).session;
    if (saved) setSession(saved);
  }
  async function transmit(action?: ReplayAction) {
    if (submitted.current) return;
    submitted.current = true; setPending(true); setError("");
    if (action) setRetry(action);
    try {
      const response = await fetch(`/api/replay/${session.id}`, action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : { cache: "no-store" });
      const body = await response.json();
      if (body.session) { setSession(body.session); setInspectOriginal(false); setUncertain(false); setRetry(null); }
      if (!response.ok) { setError(body.error?.message ?? "Could not save practice."); if (!body.session) setUncertain(true); }
    } catch { setError("Connection lost. Refresh saved progress or retry the same action."); setUncertain(true); }
    finally { submitted.current = false; setPending(false); }
  }
  function advance(action: "NEXT" | "SKIP") {
    void transmit({ action, expectedRevision: session.revision, requestId: crypto.randomUUID() });
  }
  const puzzle = session.puzzle;
  const comparison = session.comparison;
  return <>
    <h1 className="text-3xl font-semibold">Beat your past self</h1>
    <p className="mt-3 text-[#465c50]">{session.completed ? "Session complete" : `Challenge ${session.index + 1} of ${session.total} · Find the validated sequence.`}</p>
    {session.completed ? <section className="mt-6 space-y-3 rounded-2xl border border-[#20382e]/15 bg-white p-6">
      <h2 className="text-xl font-semibold">{session.results.firstTry} of {session.total} solved first try without hints</h2>
      <p>{session.results.retried} solved after retry · {session.results.assisted} assisted solves · {session.results.revealed} revealed · {session.results.skipped} skipped</p>
      <p className="text-sm text-[#465c50]">These results describe this practice session. Earlier puzzle completions are preserved.</p>
      <StartReplay gameId={session.restartGameId ?? undefined} /><Link className="block underline" href="/replay">Practice library and recent sessions</Link>
    </section> : puzzle && <PuzzleSolver key={`${session.id}-${puzzle.id}`} initialPuzzle={puzzle} nextId={null} sessionPractice={{ endpoint: `/api/replay/${session.id}`, onResponse, onBusy: setSolverBusy, locked: pending || uncertain,
      comparison: comparison && <section aria-label="Your comparison" className="space-y-3 rounded-xl border border-[#20382e]/15 p-4">
        <h2 className="font-semibold">Your comparison</h2>
        <p>Your original move: <strong>{comparison.original.san}</strong></p>
        <p>Your first attempt: <strong>{comparison.firstAttempt?.san ?? "Revealed before playing a legal move"}</strong></p>
        <p>Validated solution: <strong>{puzzle.solutionLine?.map(move => move.san).join(" → ")}</strong></p>
        <p>{puzzle.progress.state === "REVEALED" ? "Solution revealed." : puzzle.progress.assisted ? "Solved with assistance." : session.mistakes ? "You found the improvement after retrying." : "You found the improvement first try without hints."}</p>
        {comparison.explanation && <p>{comparison.explanation}</p>}{comparison.lesson && <p className="text-sm">{comparison.lesson}</p>}
        <button className="underline text-sm" onClick={() => setInspectOriginal(value => !value)}>{inspectOriginal ? "Hide original position" : "Inspect original move"}</button>
        {inspectOriginal && <ReplayBoard fen={comparison.original.fen} userColor={puzzle.playerColor} lastMove={comparison.original.uci} positionLabel="Your original move" />}
        <Link className="block text-sm underline" href={`/games/${comparison.gameId}?ply=${comparison.sourcePly}`}>Open source review</Link>
      </section>,
      navigation: <><button className="rounded-lg bg-[#20382e] px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={pending || uncertain || solverBusy} onClick={() => advance(puzzle.progress.state === "SOLVING" ? "SKIP" : "NEXT")}>{puzzle.progress.state === "SOLVING" ? "Skip challenge" : session.index + 1 === session.total ? "Finish session" : "Next challenge →"}</button><Link className="underline" href="/replay">Save and return to practice library</Link></> }} />}
    {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
    {uncertain && <div className="mt-3 flex gap-4"><button disabled={pending} onClick={() => void transmit()}>Refresh saved progress</button>{retry && <button disabled={pending} onClick={() => void transmit(retry!)}>Retry saving action</button>}</div>}
  </>;
}
