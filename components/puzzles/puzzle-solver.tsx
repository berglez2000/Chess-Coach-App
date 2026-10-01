"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useRef, useState } from "react";
import { ReplayBoard } from "@/components/chess/replay-board";
import type { PuzzleAction, SolverPuzzle } from "@/types/puzzle";

const buttonClass = "rounded-lg border border-[#20382e]/30 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-40";
const feedback: Record<string, string> = {
  ILLEGAL: "Illegal move. The position has not changed; try again.",
  INCORRECT: "That move is legal, but it is not a solution. Try again.",
  CORRECT: "Correct! Puzzle solved.",
  ACCEPTED_ALTERNATIVE: "Correct! Your move is an accepted alternative.",
  HINT: "Hint saved. This solve will be marked assisted.",
  REVEALED: "Solution revealed. Retry to play it yourself; this will be an assisted solve.",
  RETRY: "Starting position restored. Try again.",
  FINISHED: "This attempt has ended. Retry to practice again.",
};
export function PuzzleSolver({ initialPuzzle, nextId }: { initialPuzzle: SolverPuzzle; nextId: string | null }) {
  const [puzzle, setPuzzle] = useState(initialPuzzle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [moveText, setMoveText] = useState("");
  const [promotion, setPromotion] = useState("q");
  const submitted = useRef(false);
  const [retryRequest, setRetryRequest] = useState<PuzzleAction | null>(null);
  const solving = puzzle.progress.state === "SOLVING";
  const locked = pending || uncertain;
  const board = new Chess(puzzle.startingFen);

  async function transmit(action?: PuzzleAction) {
    if (submitted.current) return;
    submitted.current = true;
    setPending(true); setError(""); setSelected(null);
    if (action) setRetryRequest(action);
    try {
      const response = await fetch(`/api/puzzles/${puzzle.id}`, action ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      } : { cache: "no-store" });
      const body = await response.json();
      if (body.puzzle) {
        setPuzzle(body.puzzle); setUncertain(false); setRetryRequest(null); setMoveText("");
      }
      if (!response.ok) {
        setError(body.error?.message ?? "Could not save progress. Refresh before retrying.");
        if (!body.puzzle) setUncertain(true);
      }
    } catch {
      setError("Connection lost. Refresh saved progress or retry saving the same action.");
      setUncertain(true);
    } finally { submitted.current = false; setPending(false); }
  }
  function act(action: "MOVE" | "HINT" | "REVEAL" | "RETRY", move?: string) {
    if (locked || submitted.current) return;
    const base = { requestId: crypto.randomUUID(), expectedRevision: puzzle.progress.revision };
    void transmit(action === "MOVE" ? { ...base, action, move: move! } : { ...base, action });
  }
  function move(from: string, to: string, promote = promotion) {
    if (!solving || locked) return false;
    const piece = board.get(from as Parameters<typeof board.get>[0]);
    const suffix = piece?.type === "p" && /^[a-h][18]$/.test(to) ? promote : "";
    act("MOVE", from + to + suffix);
    // Wait for the authoritative saved result before changing the board.
    return false;
  }
  return <section aria-label="Puzzle practice" aria-busy={pending} className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div className="min-w-0">
      <ReplayBoard positionLabel="Puzzle" fen={puzzle.solution?.fen ?? puzzle.startingFen} userColor={puzzle.playerColor}
        lastMove={puzzle.solution?.uci} selectedSquare={selected}
        onMove={solving && !locked ? move : undefined}
        onSquareClick={solving && !locked ? square => {
          const piece = board.get(square as Parameters<typeof board.get>[0]);
          if (piece?.color === board.turn()) { setSelected(square); setError(""); }
          else if (selected) move(selected, square);
        } : undefined} />
      <p className="mt-3 text-sm">{puzzle.playerColor === "WHITE" ? "White" : "Black"} to play · Find one strong move.</p>
      {solving && <>
        <p className="mt-2 text-sm text-[#465c50]">Drag a piece, select its square and destination, or enter move coordinates. Choose a promotion piece before moving a pawn to the last rank.</p>
        <label className="mt-3 block text-sm">Promotion piece <select disabled={locked} className="rounded border p-2" value={promotion} onChange={event => setPromotion(event.target.value)}>
          <option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option>
        </select></label>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => {
          event.preventDefault();
          const input = moveText.trim().toLowerCase();
          if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input)) { setError("Enter a move such as e2e4 or a7a8n."); return; }
          if (input.length === 5) act("MOVE", input);
          else move(input.slice(0, 2), input.slice(2, 4));
        }}>
          <label className="text-sm">Move coordinates<input disabled={locked} className="ml-2 w-28 rounded border p-2" value={moveText} onChange={event => setMoveText(event.target.value)} placeholder="e2e4" /></label>
          <button disabled={locked} className={buttonClass}>Check move</button>
        </form>
      </>}
    </div>
    <div className="space-y-4 rounded-2xl border border-[#20382e]/15 bg-white p-5">
      <h2 className="text-lg font-semibold">Find the better move</h2>
      <p role="status" aria-label="Puzzle feedback" className="text-sm" aria-live="polite">{pending ? "Saving progress…" : feedback[puzzle.progress.lastOutcome ?? ""] ?? "Your answer is checked after you play a move."}</p>
      {puzzle.hintSquare && <p className="text-sm">Hint: move the piece on <strong>{puzzle.hintSquare}</strong>.</p>}
      {puzzle.solution && <p className="text-sm">Solution: <strong>{puzzle.solution.san}</strong></p>}
      <p className="text-sm">Moves tried: {puzzle.progress.moveAttempts}</p>
      <p className="text-sm">{puzzle.progress.assisted ? "Assisted practice: you have used help or already seen the solution." : "No hints or reveals used."}</p>
      {puzzle.progress.completedAt && <p className="text-sm font-semibold">First completion saved · {puzzle.progress.completionAssisted ? "Assisted" : "Unassisted"}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={locked || !solving} className={buttonClass} onClick={() => act("HINT")}>Hint</button>
        <button type="button" disabled={locked || !solving} className={buttonClass} onClick={() => act("REVEAL")}>Reveal solution</button>
        <button type="button" disabled={locked} className={buttonClass} onClick={() => act("RETRY")}>Retry puzzle</button>
      </div>
      <p className="text-xs text-[#657467]">Hints and reveals are saved. Retrying keeps that assistance and your first completion history.</p>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {uncertain && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={buttonClass} onClick={() => void transmit()}>Refresh saved progress</button>
        {retryRequest && <button type="button" disabled={pending} className={buttonClass} onClick={() => void transmit(retryRequest!)}>Retry saving action</button>}
      </div>}
      <nav aria-label="Puzzle navigation" className="flex flex-col gap-3 text-sm">
        {nextId ? <Link className="font-semibold underline" href={`/puzzles/${nextId}`}>Next puzzle →</Link> : <Link className="font-semibold underline" href={`/puzzles?game=${puzzle.gameId}`}>Back to this game’s puzzles</Link>}
        <Link className="underline" href={`/games/${puzzle.gameId}?ply=${puzzle.sourcePly}`}>Return to source review</Link>
        <Link className="underline" href="/puzzles">All puzzles</Link>
      </nav>
    </div>
  </section>;
}
