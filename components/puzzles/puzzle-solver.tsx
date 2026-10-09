"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { PromotionPicker } from "@/components/chess/promotion-picker";
import { ReplayBoard } from "@/components/chess/replay-board";
import { useMoveSound } from "@/components/chess/use-move-sound";
import type { PuzzleAction, SolverPuzzle } from "@/types/puzzle";

import styles from "@/components/learning/practice.module.css";

const buttonClass = "rounded-lg border border-[#20382e]/30 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-40";
const feedback: Record<string, string> = {
  UNSUPPORTED: "That move is legal, but is outside this exercise’s validated solution set. Try the authored sequence.",
  ILLEGAL: "Illegal move. The position has not changed; try again.",
  INCORRECT: "That move is legal, but it is not a solution. Try again.",
  CORRECT: "Correct! Puzzle solved.",
  ACCEPTED_ALTERNATIVE: "Correct! Your move is an accepted alternative.",
  CONTINUE: "Correct. The opponent replied automatically; find your next move.",
  ALTERNATIVE_CONTINUE: "Accepted alternative. The opponent replied automatically; find your next move.",
  HINT: "Hint saved. This solve will be marked assisted.",
  REVEALED: "Solution revealed. Retry to play it yourself; this will be an assisted solve.",
  RETRY: "Starting position restored. Try again.",
  FINISHED: "This attempt has ended. Retry to practice again.",
};
export function PuzzleSolver({ initialPuzzle, nextId, learningNavigation, sessionPractice }: { sessionPractice?: { endpoint: string; locked?: boolean; onBusy?: (busy: boolean) => void; onResponse: (body: unknown) => void; comparison: ReactNode; navigation: ReactNode }; initialPuzzle: SolverPuzzle; nextId: string | null; learningNavigation?: { chapterUrl: string; previousUrl: string | null; nextUrl: string | null; title?: string; chapterTitle?: string; number?: string } }) {
  const { play, muted, toggleMuted } = useMoveSound();
  const [puzzle, setPuzzle] = useState(initialPuzzle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [moveText, setMoveText] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);
  const submitted = useRef(false);
  const [retryRequest, setRetryRequest] = useState<PuzzleAction | null>(null);
  const placementPiece = puzzle.learning?.type === "MISSING_PIECE" ? puzzle.learning.placementPiece : undefined;
  const solving = puzzle.progress.state === "SOLVING";
  const locked = pending || uncertain || !!promotionMove || !!sessionPractice?.locked;
  const displayedFen = puzzle.progress.state === "REVEALED" ? puzzle.solutionLine?.at(-1)?.fen ?? puzzle.currentFen : puzzle.currentFen;
  const board = new Chess(displayedFen);

  async function transmit(action?: PuzzleAction) {
    if (submitted.current) return;
    submitted.current = true;
    setPending(true); sessionPractice?.onBusy?.(true); setError(""); setSelected(null);
    if (action) setRetryRequest(action);
    try {
      const response = await fetch(sessionPractice?.endpoint ?? (puzzle.learning ? `/api/learning/exercises/${puzzle.id}?revision=${puzzle.learning.revisionId}` : `/api/puzzles/${puzzle.id}`), action ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      } : { cache: "no-store" });
      const body = await response.json();
      sessionPractice?.onResponse(body);
      if (body.puzzle) {
        const saved: SolverPuzzle = body.puzzle;
        // The player's sound starts during the input gesture. Announce an
        // automatic reply only after the server confirms it.
        if (response.ok && action?.action === "MOVE" && saved.history.length > puzzle.history.length + 1) {
          const lastMove = saved.history.at(-1)!;
          play(lastMove.san, new Chess(lastMove.fen).isGameOver());
        }
        setPuzzle(body.puzzle); setUncertain(false); setRetryRequest(null); setMoveText("");
      }
      if (!response.ok) {
        setError(body.error?.message ?? "Could not save progress. Refresh before retrying.");
        if (!body.puzzle) setUncertain(true);
      }
    } catch {
      setError("Connection lost. Refresh saved progress or retry saving the same action.");
      setUncertain(true);
    } finally { submitted.current = false; setPending(false); sessionPractice?.onBusy?.(false); }
  }
  function act(action: "MOVE" | "HINT" | "REVEAL" | "RETRY", move?: string, promotionConfirmed = false) {
    if (pending || uncertain || (promotionMove && !promotionConfirmed) || submitted.current) return;
    if (action === "MOVE" && !placementPiece) {
      // Start playback before awaiting fetch so browser gesture restrictions
      // do not silence moves. Legal attempts sound even when not the solution.
      const position = new Chess(puzzle.currentFen);
      try {
        const played = position.move({ from: move!.slice(0, 2), to: move!.slice(2, 4), promotion: move!.slice(4) || "q" });
        play(played.san, position.isGameOver());
      } catch { /* Illegal moves leave the position unchanged and stay silent. */ }
    }
    const base = { requestId: crypto.randomUUID(), expectedRevision: puzzle.progress.revision };
    void transmit(action === "MOVE" ? { ...base, action, move: move! } : { ...base, action });
  }
  function move(from: string, to: string) {
    if (!solving || locked) return false;
    const piece = board.get(from as Parameters<typeof board.get>[0]);
    const legalPromotion = piece?.type === "p" && board.moves({ square: from as Parameters<typeof board.get>[0], verbose: true }).some(candidate => candidate.to === to && candidate.promotion);
    if (legalPromotion) {
      setPromotionMove({ from, to, color: piece.color });
      return false;
    }
    act("MOVE", from + to);
    // Wait for the authoritative saved result before changing the board.
    return false;
  }
  return <>
    {promotionMove && <PromotionPicker color={promotionMove.color} onCancel={() => { setPromotionMove(null); setSelected(null); }} onChoose={piece => {
      const coordinates = promotionMove.from + promotionMove.to + piece;
      setPromotionMove(null);
      act("MOVE", coordinates, true);
    }} />}
    <section aria-label="Puzzle practice" aria-busy={pending} className={learningNavigation ? styles.solver : "mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}>
    <div className={learningNavigation ? styles.boardPanel : "min-w-0"}>
      {learningNavigation && <div className={styles.strip}><span className={styles.colorDot} style={{ background: puzzle.playerColor === "WHITE" ? "var(--fg)" : "white" }}/><strong>{puzzle.playerColor === "WHITE" ? "Black" : "White"}</strong><small>Opponent</small></div>}
      <ReplayBoard positionLabel="Puzzle" flipped={flipped} fen={displayedFen} userColor={puzzle.playerColor}
        lastMove={placementPiece ? undefined : puzzle.progress.state === "REVEALED" ? puzzle.solutionLine?.at(-1)?.uci : puzzle.history.at(-1)?.uci} selectedSquare={selected}
        onMove={solving && !locked && !placementPiece ? move : undefined}
        onSquareClick={solving && !locked ? square => {
          if (placementPiece) { act("MOVE", `${placementPiece}@${square}`); return; }
          const piece = board.get(square as Parameters<typeof board.get>[0]);
          if (piece?.color === board.turn()) { setSelected(square); setError(""); }
          else if (selected) move(selected, square);
        } : undefined} />
      {learningNavigation ? <><div className={styles.controls}><button type="button" onClick={() => setFlipped(value => !value)} aria-label="Flip board">⇄ Flip board</button><button type="button" onClick={toggleMuted} aria-pressed={muted} aria-label="Mute sounds">Sound: {muted ? "off" : "on"}</button><span>{placementPiece ? "Place the missing piece" : `${puzzle.playerColor === "WHITE" ? "White" : "Black"} to move`}</span></div><div className={styles.strip}><span className={styles.colorDot} style={{ background: puzzle.playerColor === "WHITE" ? "white" : "var(--fg)" }}/><strong>{puzzle.playerColor === "WHITE" ? "White" : "Black"}</strong><small>You{solving ? placementPiece ? " — place a piece" : " — to move" : ""}</small></div></> : <><button type="button" className={`${buttonClass} mt-3`} onClick={toggleMuted} aria-pressed={muted} aria-label="Mute sounds">Sound: {muted ? "off" : "on"}</button><p className="mt-3 text-sm">{puzzle.playerColor === "WHITE" ? "White" : "Black"} to play · {puzzle.maxPlayerMoves === 1 ? "Find one strong move." : `Find the tactical sequence · up to ${puzzle.maxPlayerMoves} of your moves.`}</p></>}
      {puzzle.history.length > 0 && <p aria-label="Played sequence" className="mt-2 text-sm">Played: {puzzle.history.map(move => move.san).join(" → ")}</p>}
      {solving && <details className={learningNavigation ? styles.entry : "mt-3"} open={learningNavigation ? undefined : true}><summary>{placementPiece ? "Place by square" : "Move entry and promotion"}</summary>
        <p className="mt-2 text-sm text-[#465c50]">{placementPiece ? "Click an empty square to add the specified piece, or enter its square below." : "Drag a piece, select its square and destination, or enter move coordinates. When a pawn reaches the last rank, choose its promotion piece."}</p>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => {
          event.preventDefault();
          const input = moveText.trim().toLowerCase();
          if (placementPiece) {
            if (!/^[a-h][1-8]$/.test(input)) { setError("Enter a square such as g6."); return; }
            act("MOVE", `${placementPiece}@${input}`); return;
          }
          if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input)) { setError("Enter a move such as e2e4 or a7a8n."); return; }
          if (input.length === 5) act("MOVE", input);
          else move(input.slice(0, 2), input.slice(2, 4));
        }}>
          <label className="text-sm">{placementPiece ? "Placement square" : "Move coordinates"}<input disabled={locked} className="ml-2 w-28 rounded border p-2" value={moveText} onChange={event => setMoveText(event.target.value)} placeholder={placementPiece ? "g6" : "e2e4"} /></label>
          <button disabled={locked} className={buttonClass}>{placementPiece ? "Check placement" : "Check move"}</button>
        </form>
      </details>}
    </div>
    <div className={learningNavigation ? styles.right : "space-y-4 rounded-2xl border border-[#20382e]/15 bg-white p-5"}>
      <div className={learningNavigation ? `${styles.card} space-y-4` : "space-y-4"}>
      {learningNavigation && <><p className={styles.eyebrow}>{learningNavigation.chapterTitle} · Exercise {learningNavigation.number}</p><h1>{learningNavigation.title}</h1></>}
      <h2 className={learningNavigation ? styles.objective : "text-lg font-semibold"}>{puzzle.learning?.objective ?? "Find the better move"}</h2>
      {puzzle.learning?.prompt && <p className="text-sm">{puzzle.learning.prompt}</p>}
      {learningNavigation && !puzzle.learning?.publishedSolution && <div className={styles.field}><p className={styles.label}>Book solution</p><p className={styles.notes}>Reveal the solution or solve the exercise to see the book answer.</p></div>}
      {puzzle.learning?.hint && <div className={styles.hint}><p className={styles.label}>Hint</p><p>{puzzle.learning.hint}</p></div>}
      {puzzle.learning?.publishedSolution && <div className={styles.solution}><p className={styles.label}>Book solution</p><p>{puzzle.learning.publishedSolution}</p></div>}
      <p role="status" aria-label="Puzzle feedback" className={learningNavigation ? styles.feedback : "text-sm"} aria-live="polite">{pending ? "Saving progress…" : (sessionPractice && puzzle.progress.lastOutcome === "INCORRECT" ? "That move is legal, but it is not the validated solution. Try again." : (placementPiece && puzzle.progress.lastOutcome === "ILLEGAL" ? "Choose an empty square that leaves your king safe. Pawns cannot be placed on the first or last rank." : placementPiece && puzzle.progress.lastOutcome === "INCORRECT" ? "That placement does not give checkmate. Try another square." : placementPiece && puzzle.progress.lastOutcome === "UNSUPPORTED" ? "That placement is outside the book’s supplied answer. Try another square." : feedback[puzzle.progress.lastOutcome ?? ""])) ?? (placementPiece ? "Choose an empty square for the missing piece." : "Your answer is checked after you play a move.")}</p>
      {puzzle.hintSquare && <p className="text-sm">Hint: {placementPiece ? "place the missing piece on" : "move the piece on"} <strong>{puzzle.hintSquare}</strong>.</p>}
      {puzzle.solutionLine && <p className="text-sm">Solution: <strong>{puzzle.solutionLine.map(move => move.san).join(" → ")}</strong></p>}
      {puzzle.goal && <p className="text-sm">{puzzle.goal === "mate" ? "Checkmate reached." : puzzle.goal === "terminal" ? "The game has ended." : "Validated sequence complete. This puzzle ends here; the game may continue."}</p>}
      <p className="text-sm">{placementPiece ? "Placements tried" : "Moves tried"}: {puzzle.progress.moveAttempts}</p>
      <p className="text-sm">{puzzle.progress.assisted ? "Assisted practice: you have used help or already seen the solution." : "No hints or reveals used."}</p>
      {!sessionPractice && puzzle.progress.completedAt && <p className="text-sm font-semibold">First completion saved · {puzzle.progress.completionAssisted ? "Assisted" : "Unassisted"}</p>}
      <div className={learningNavigation ? styles.actions : "flex flex-wrap gap-2"}>
        <button type="button" disabled={locked || !solving} className={buttonClass} onClick={() => act("HINT")}>{learningNavigation ? "Show hint" : "Hint"}</button>
        <button type="button" disabled={locked || !solving} className={buttonClass} onClick={() => act("REVEAL")}>Reveal solution</button>
        <button type="button" disabled={locked || (!!sessionPractice && !solving)} className={buttonClass} onClick={() => act("RETRY")}>Retry puzzle</button>
      </div>
      <p className="text-xs text-[#657467]">{sessionPractice ? "Retrying preserves mistakes and assistance. Start another session for a fresh attempt." : "Hints and reveals are saved. Retrying keeps that assistance and your first completion history."}</p>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {uncertain && <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={buttonClass} onClick={() => void transmit()}>Refresh saved progress</button>
        {retryRequest && <button type="button" disabled={pending} className={buttonClass} onClick={() => void transmit(retryRequest!)}>Retry saving action</button>}
      </div>}
      </div>
      {puzzle.learning?.explanation && <section className={styles.card}><h2 className="mb-2 text-sm font-semibold">Explanation</h2><p>{puzzle.learning.explanation}</p></section>}
      {sessionPractice?.comparison}
      <nav aria-label="Puzzle navigation" className={learningNavigation ? `${styles.card} ${styles.navigation}` : "flex flex-col gap-3 text-sm"}>
        {sessionPractice ? sessionPractice.navigation : learningNavigation ? <>
          {learningNavigation.previousUrl && <Link className="underline" href={learningNavigation.previousUrl}>← Previous exercise</Link>}
          {learningNavigation.nextUrl && <Link className="underline font-semibold" href={learningNavigation.nextUrl}>Next exercise →</Link>}
          <Link className="underline" href={learningNavigation.chapterUrl}>Return to chapter</Link>
          <Link className="underline" href="/learning/materials">Learning library</Link>
        </> : <>
        {nextId ? <Link className="font-semibold underline" href={`/puzzles/${nextId}`}>Next puzzle →</Link> : <Link className="font-semibold underline" href={`/puzzles?game=${puzzle.gameId}`}>Back to this game’s puzzles</Link>}
        <Link className="underline" href={`/games/${puzzle.gameId}?ply=${puzzle.sourcePly}`}>Return to source review</Link>
        <Link className="underline" href="/puzzles">All puzzles</Link>
        </>}
      </nav>
    </div>
  </section></>;
}
