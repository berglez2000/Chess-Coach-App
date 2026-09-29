"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useState } from "react";
import type { ChessColor } from "@/types/game";
import type { AnalysisStatus, ReviewGame } from "@/types/saved-game";
import { ReplayBoard } from "@/components/chess/replay-board";
import { useMoveSound } from "@/components/chess/use-move-sound";
import { EvaluationBar } from "@/components/chess/evaluation-bar";
import { EnginePanel } from "./engine-panel";
import { MoveList } from "./move-list";
import { MoveQualityBadge } from "./move-quality-badge";
import { CoachingPanel } from "./coaching-panel";
import { CoachingSummaryPanel } from "./coaching-summary-panel";

/** Mount a fresh review for each imported game. Selected ply owns all replay state. */
export function GameReview({ game, userColor, status }: { game: ReviewGame; userColor: ChessColor; status: AnalysisStatus }) {
  const { play, muted, toggleMuted } = useMoveSound();
  const [selectedPly, setSelectedPly] = useState(0);
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState("all");
  const [flipped, setFlipped] = useState(false);
  const selectedMove = selectedPly === 0 ? null : game.moves[selectedPly - 1];
  const analysis = selectedPly === 0 ? game.moves[0]?.analysis : selectedMove?.analysis;
  let previewFen: string | null = null;
  let previewUci: string | undefined;
  if (analysis?.bestMoveSan) {
    try {
      const position = new Chess(selectedMove?.fenBefore ?? game.initialFen);
      const move = position.move(analysis.bestMoveSan);
      previewFen = position.fen();
      previewUci = move.from + move.to;
    } catch { /* A stale saved suggestion must not interrupt replay. */ }
  }
  const fen = preview && previewFen ? previewFen : selectedMove?.fenAfter ?? game.initialFen;
  const total = game.moves.length;
  const analyzed = game.moves.filter(move => move.analysis);
  const critical = analyzed.filter(move => move.analysis?.quality === "mistake" || move.analysis?.quality === "blunder" || move.analysis?.quality === "inaccuracy");
  const mixedRuns = new Set(analyzed.map(move => move.analysis!.runId)).size > 1;
  const select = useCallback((ply: number) => {
    const next = Math.max(0, Math.min(total, ply));
    if (next !== selectedPly || preview) {
      // Backward navigation uses the ordinary move sound, rather than announcing
      // a capture or game ending that is being undone.
      play(next > selectedPly ? game.moves[next - 1]?.san ?? "" : "",
        next > selectedPly && next === total && game.metadata.result !== "*");
    }
    setPreview(false);
    setSelectedPly(next);
  }, [total, selectedPly, preview, play, game.moves, game.metadata.result]);
  const buttonClass = "rounded-lg border border-[#20382e]/30 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
      e.preventDefault();
      select(selectedPly + (e.key === "ArrowRight" ? 1 : -1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [select, selectedPly]);
  const { metadata } = game;
  const time = metadata.timeControl?.match(/^(\d+)(?:\+(\d+))?$/);
  const timeLabel = time ? `${Number(time[1]) / 60} min${time[2] ? ` + ${time[2]} sec` : ""}` : metadata.timeControl;
  const filteredMoves = filter === "all" ? game.moves : game.moves.filter(move => move.analysis?.quality === filter);
  const nextCritical = critical.find(move => move.ply > selectedPly) ?? critical[0];

  return (
    <section className="mt-6" aria-labelledby="review-heading">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#657467]">Game review</p>
      <h2 id="review-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{metadata.whiteName ?? "White"} <span className="font-normal text-[#657467]">vs.</span> {metadata.blackName ?? "Black"}</h2>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#465c50]">
        <div><dt className="inline font-semibold">Result: </dt><dd className="inline">{metadata.result}</dd></div>
        {metadata.playedAt && <div><dt className="inline font-semibold">Date: </dt><dd className="inline">{metadata.playedAt.slice(0, 10)}</dd></div>}
        {metadata.openingName && <div><dt className="inline font-semibold">Opening: </dt><dd className="inline">{metadata.openingName}{metadata.eco ? ` (${metadata.eco})` : ""}</dd></div>}
        {metadata.timeControl && <div><dt className="inline font-semibold">Time control: </dt><dd className="inline">{timeLabel}</dd></div>}
      </dl>
      <p className="mt-4 text-sm">Saved analysis: {analyzed.length} of {total} moves{analyzed.length > 0 && analyzed.length < total ? " (partial)" : ""}.</p>
      {mixedRuns && <p className="mt-2 text-sm">These results include multiple analysis runs. A retry may still be incomplete.</p>}
      {critical.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="rounded-xl bg-[#20382e] px-5 py-3 text-sm font-semibold text-white hover:bg-[#345443]" onClick={() => { setFilter("all"); select(nextCritical.ply); }}>
          {selectedPly === 0 ? "Review key moments" : "Next key moment"} →
        </button>
        <span className="text-sm text-[#657467]">{critical.length} moments to learn from · Both players</span>
      </div>}
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-stretch gap-2 sm:gap-3">
            <EvaluationBar evaluation={preview ? null : selectedPly === 0 ? game.moves[0]?.analysis?.before : selectedMove?.analysis?.after}
              whiteBottom={(userColor === "WHITE") !== flipped} />
            <ReplayBoard fen={fen} userColor={userColor} flipped={flipped} lastMove={preview ? previewUci : selectedMove?.uci}
              moveQuality={preview ? undefined : selectedMove?.analysis?.quality ?? selectedMove?.coaching?.classification} />
          </div>
          {preview && <p role="status" className="mt-3 rounded-lg bg-[#e4eddf] p-3 text-sm">Suggested move: {analysis?.bestMoveSan} · Preview from before the played move</p>}
          <p className="mt-3 text-sm" aria-live="polite" aria-atomic="true">
            {selectedMove ? `Move ${selectedMove.moveNumber}${selectedMove.color === "WHITE" ? "." : "..."} ${selectedMove.san}` : "Initial position"}
            {` · Half-move ${selectedPly} of ${total}`}
          </p>
          {selectedMove && !preview && <div className="mt-2" aria-live="polite" aria-atomic="true"><MoveQualityBadge quality={selectedMove.analysis?.quality ?? selectedMove.coaching?.classification} showLabel /></div>}
          <p className="mt-1 text-sm text-[#657467]">{fen.split(" ")[1] === "w" ? "White" : "Black"} to play · Use ← → to navigate</p>
          <nav aria-label="Move navigation" className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => select(0)} disabled={selectedPly === 0}>Start</button>
            <button type="button" className={buttonClass} onClick={() => select(selectedPly - 1)} disabled={selectedPly === 0}>Previous</button>
            <button type="button" className={buttonClass} onClick={() => select(selectedPly + 1)} disabled={selectedPly === total}>Next</button>
            <button type="button" className={buttonClass} onClick={() => select(total)} disabled={selectedPly === total}>End</button>
            <button type="button" className={buttonClass} onClick={() => setFlipped(f => !f)} aria-pressed={flipped}>Flip board</button>
            <button type="button" className={buttonClass} onClick={toggleMuted} aria-pressed={muted} aria-label="Mute sounds">Sound: {muted ? "off" : "on"}</button>
          </nav>
        </div>
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[#20382e]/15 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#657467]">{selectedMove ? `What happened · ${selectedMove.moveNumber}${selectedMove.color === "WHITE" ? "." : "…"} ${selectedMove.san}` : "Your move-by-move guide"}</p>
            {selectedMove ? <CoachingPanel coaching={selectedMove.coaching} status={status} /> : <p className="mt-3 text-sm leading-relaxed">Select a move or review the key moments to see what happened, why it matters, and what to try next.</p>}
            {analysis?.bestMoveSan && <div className="mt-4 border-t border-[#20382e]/10 pt-4">
              <p className="text-sm font-semibold">{selectedMove && selectedMove.san !== analysis.bestMoveSan ? "Try instead" : "Engine suggestion"}: {analysis.bestMoveSan}</p>
              {previewFen && <button type="button" className={`${buttonClass} mt-2`} aria-pressed={preview} onClick={() => { if ((preview ? selectedMove?.fenAfter ?? game.initialFen : previewFen) !== fen) play(preview ? "" : analysis.bestMoveSan ?? ""); setPreview(value => !value); }}>{preview ? "Return to game" : "Show on board"}</button>}
            </div>}
            <details className="mt-4 border-t border-[#20382e]/10 pt-4"><summary className="cursor-pointer text-sm font-medium">Engine details</summary><EnginePanel initial={selectedPly === 0} analysis={analysis} /></details>
          </div>
          <div className="rounded-2xl border border-[#20382e]/15 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Moves</h3><label className="text-sm"><span className="sr-only">Filter moves</span><select className="rounded-lg border border-[#20382e]/20 bg-[#f6f5f0] p-2" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All moves</option><option value="inaccuracy">Inaccuracies</option><option value="mistake">Mistakes</option><option value="blunder">Blunders</option></select></label></div>
            {filteredMoves.length > 0 ? <MoveList moves={filteredMoves} selectedPly={selectedPly} onSelect={select} /> : <p className="py-6 text-center text-sm text-[#657467]">No moves match this filter.</p>}
          </div>
        </div>
      </div>
      <CoachingSummaryPanel coaching={game.coaching} moves={game.moves} status={status} onSelectPly={select} />
    </section>
  );
}
