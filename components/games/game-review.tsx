"use client";

import { useState } from "react";
import type { ChessColor } from "@/types/game";
import type { ReviewGame } from "@/types/saved-game";
import { ReplayBoard } from "@/components/chess/replay-board";
import { MoveList } from "./move-list";

/** Mount a fresh review for each imported game. Selected ply owns all replay state. */
export function GameReview({ game, userColor }: { game: ReviewGame; userColor: ChessColor }) {
  const [selectedPly, setSelectedPly] = useState(0);
  const selectedMove = selectedPly === 0 ? null : game.moves[selectedPly - 1];
  const fen = selectedMove?.fenAfter ?? game.initialFen;
  const total = game.moves.length;
  const select = (ply: number) => setSelectedPly(Math.max(0, Math.min(total, ply)));
  const buttonClass = "rounded-lg border border-[#20382e]/30 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2";
  const { metadata } = game;

  return (
    <section className="mt-10 border-t border-[#20382e]/20 pt-8" aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-2xl font-semibold">Game review</h2>
      <p className="mt-2 text-lg">{metadata.whiteName ?? "White"} (White) vs. {metadata.blackName ?? "Black"} (Black)</p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#465c50]">
        <div><dt className="inline font-semibold">Result: </dt><dd className="inline">{metadata.result}</dd></div>
        {metadata.playedAt && <div><dt className="inline font-semibold">Date: </dt><dd className="inline">{metadata.playedAt.slice(0, 10)}</dd></div>}
        {metadata.openingName && <div><dt className="inline font-semibold">Opening: </dt><dd className="inline">{metadata.openingName}{metadata.eco ? ` (${metadata.eco})` : ""}</dd></div>}
        {metadata.timeControl && <div><dt className="inline font-semibold">Time control: </dt><dd className="inline">{metadata.timeControl}</dd></div>}
      </dl>
      <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ReplayBoard fen={fen} userColor={userColor} />
          <p className="mt-3 text-sm" aria-live="polite" aria-atomic="true">
            {selectedMove ? `Move ${selectedMove.moveNumber}${selectedMove.color === "WHITE" ? "." : "..."} ${selectedMove.san}` : "Initial position"}
            {` · Half-move ${selectedPly} of ${total}`}
          </p>
          <nav aria-label="Move navigation" className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => select(0)} disabled={selectedPly === 0}>Start</button>
            <button type="button" className={buttonClass} onClick={() => select(selectedPly - 1)} disabled={selectedPly === 0}>Previous</button>
            <button type="button" className={buttonClass} onClick={() => select(selectedPly + 1)} disabled={selectedPly === total}>Next</button>
            <button type="button" className={buttonClass} onClick={() => select(total)} disabled={selectedPly === total}>End</button>
          </nav>
        </div>
        <MoveList moves={game.moves} selectedPly={selectedPly} onSelect={select} />
      </div>
    </section>
  );
}
