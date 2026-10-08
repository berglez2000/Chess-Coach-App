"use client";

import { useState } from "react";
import type { ChessColor } from "@/types/game";
import { explorationFen, explorationPosition, exploreMove, type Exploration } from "@/lib/pgn/exploration";
import { PositionAnalysisPanel } from "@/components/analysis/position-panel";
import { ReplayBoard } from "./replay-board";

const buttonClass = "rounded-lg border border-[#20382e]/30 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-40";

export function ExplorationBoard({ startFen, userColor, flipped, onExit }: {
  startFen: string; userColor: ChessColor; flipped: boolean; onExit: () => void;
}) {
  const [variation, setVariation] = useState<Exploration>({ startFen, moves: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState("q");
  const [error, setError] = useState("");
  const [moveText, setMoveText] = useState("");
  const chess = explorationPosition(variation);
  const terminal = chess.isCheckmate() ? "Checkmate" : chess.isStalemate() ? "Stalemate" : chess.isDraw() ? "Draw" : null;
  const turn = `${chess.turn() === "w" ? "White" : "Black"} to play${chess.isCheck() ? " · Check" : ""}`;
  function move(from: string, to: string, promote = promotion) {
    const next = exploreMove(variation, from, to, promote);
    setSelected(null);
    if (!next) { setError(terminal ? "This position has ended. Undo or reset to continue." : "Illegal move. Try another move."); return false; }
    setVariation(next);
    setError("");
    setMoveText("");
    return true;
  }
  function changeMoves(moves: string[]) {
    setVariation({ ...variation, moves });
    setSelected(null);
    setError("");
    setMoveText("");
  }
  return <div className="min-w-0">
    <p className="mb-3 rounded-lg bg-[#e4eddf] p-3 text-sm"><strong>Exploring a variation</strong> · Play both sides. Moves are temporary; saved analysis is hidden. Live analysis is available below when enabled.</p>
    <ReplayBoard fen={explorationFen(variation)} userColor={userColor} flipped={flipped}
      lastMove={variation.moves.at(-1)} selectedSquare={selected} onMove={move}
      onSquareClick={square => {
        const piece = chess.get(square as Parameters<typeof chess.get>[0]);
        if (piece?.color === chess.turn()) { setSelected(square); setError(""); }
        else if (selected) move(selected, square);
      }} />
    <p role="status" aria-label="Variation status" className="mt-3 text-sm">{terminal ?? turn}</p>
    <p className="mt-2 text-sm">Drag a piece, or select its square and then its destination. Choose the promotion piece before moving a pawn to the last rank.</p>
    <label className="mt-3 block text-sm">Promotion piece <select className="rounded border p-2" value={promotion} onChange={e => setPromotion(e.target.value)}>
      <option value="q">Queen</option><option value="r">Rook</option><option value="b">Bishop</option><option value="n">Knight</option>
    </select></label>
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={e => {
      e.preventDefault();
      const input = moveText.trim().toLowerCase();
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(input)) { setError("Enter a move such as e2e4 or a7a8n."); return; }
      move(input.slice(0, 2), input.slice(2, 4), input[4] ?? promotion);
    }}>
      <label className="text-sm">Move coordinates<input className="ml-2 w-28 rounded border p-2" value={moveText} onChange={e => setMoveText(e.target.value)} placeholder="e2e4" /></label>
      <button className={buttonClass} disabled={!!terminal}>Play move</button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    <p className="mt-3 text-sm" aria-label="Explored moves">Variation: {chess.history().join(" · ") || "No moves yet"}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={!variation.moves.length} onClick={() => changeMoves(variation.moves.slice(0, -1))}>Undo</button>
      <button type="button" className={buttonClass} onClick={() => changeMoves([])}>Reset variation</button>
      <button type="button" className={buttonClass} onClick={onExit}>Return to review</button>
    </div>
    <PositionAnalysisPanel position={variation} whiteBottom={(userColor === "WHITE") !== flipped} onPlay={line => { const uci = line[0]; move(uci.slice(0, 2), uci.slice(2, 4), uci[4] ?? "q"); }} />
  </div>;
}
