"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, defaultArrowOptions } from "react-chessboard";
import type { ChessColor } from "@/types/game";
import type { MoveQuality } from "@/types/analysis";
import { MoveQualityBadge } from "@/components/games/move-quality-badge";
import { boardTheme, customPieces } from "./board-theme";

function legalTargets(fen: string, square: string | null | undefined) {
  if (!square) return [];
  try {
    return new Chess(fen).moves({ square: square as Square, verbose: true }).map(move => ({ square: move.to, capture: move.isCapture() || move.isEnPassant() }));
  } catch {
    return [];
  }
}

export function ReplayBoard({ fen, userColor, flipped = false, lastMove, moveQuality, onMove, onSquareClick, selectedSquare, positionLabel }: { fen: string; userColor: ChessColor; flipped?: boolean; lastMove?: string; moveQuality?: MoveQuality | null; onMove?: (from: string, to: string) => boolean; onSquareClick?: (square: string) => void; selectedSquare?: string | null; positionLabel?: string }) {
  const defaultWhiteBottom = userColor === "WHITE";
  const whiteBottom = flipped ? !defaultWhiteBottom : defaultWhiteBottom;
  const destination = lastMove?.slice(2, 4);
  const file = destination ? destination.charCodeAt(0) - 97 : 0;
  const rank = destination ? Number(destination[1]) - 1 : 0;
  const [draggedSquare, setDraggedSquare] = useState<string | null>(null);
  const hintSquare = draggedSquare ?? selectedSquare;
  const targets = useMemo(() => legalTargets(fen, hintSquare), [fen, hintSquare]);
  const squareStyles: Record<string, CSSProperties> = {
    ...(lastMove ? {
      [lastMove.slice(0, 2)]: { backgroundColor: boardTheme.lastMoveFrom },
      [lastMove.slice(2, 4)]: { backgroundColor: boardTheme.lastMoveTo },
    } : {}),
    ...(hintSquare ? { [hintSquare]: { backgroundColor: "rgba(234, 179, 8, 0.5)" } } : {}),
  };
  for (const target of targets) squareStyles[target.square] = {
    ...squareStyles[target.square],
    backgroundImage: target.capture ? boardTheme.captureHint : boardTheme.moveHint,
    cursor: "pointer",
  };
  return (
    <div className="relative w-full min-w-0" role={onMove || onSquareClick ? "group" : "img"} aria-label={`${positionLabel ?? (onMove ? "Exploration" : "Game")} position, ${whiteBottom ? "White" : "Black"} at the bottom${destination && moveQuality ? `, move quality ${moveQuality} on ${destination}` : ""}`}>
      <Chessboard options={{
        id: "game-replay",
        position: fen,
        boardOrientation: whiteBottom ? "white" : "black",
        allowDragging: !!onMove,
        onPieceDrag: ({ square }) => { if (onMove) setDraggedSquare(square); },
        onPieceDragCancel: () => setDraggedSquare(null),
        onPieceDrop: ({ sourceSquare, targetSquare }) => { setDraggedSquare(null); return targetSquare ? onMove?.(sourceSquare, targetSquare) ?? false : false; },
        onSquareClick: ({ square }) => onSquareClick?.(square),
        allowDrawingArrows: true,
        clearArrowsOnClick: true,
        clearArrowsOnPositionChange: true,
        arrowOptions: {
          ...defaultArrowOptions,
          colors: { ...defaultArrowOptions.colors, default: "#ffaa00", shift: "#38bdf8" },
          arrowStartOffset: 0.3,
        },
        showAnimations: true,
        animationDurationInMs: 200,
        pieces: customPieces,
        boardStyle: { backgroundImage: `url(${boardTheme.boardImage})`, backgroundSize: "100% 100%", borderRadius: "8px", overflow: "hidden" },
        darkSquareStyle: { backgroundColor: "transparent" },
        lightSquareStyle: { backgroundColor: "transparent" },
        darkSquareNotationStyle: { color: boardTheme.darkNotation },
        lightSquareNotationStyle: { color: boardTheme.lightNotation },
        squareStyles,
      }} />
      {destination && moveQuality && <div
        data-move-quality-square={destination}
        className="pointer-events-none absolute z-10 flex items-start justify-end p-0.5"
        style={{ width: "12.5%", height: "12.5%", left: `${(whiteBottom ? file : 7 - file) * 12.5}%`, top: `${(whiteBottom ? 7 - rank : rank) * 12.5}%` }}
      >
        <MoveQualityBadge quality={moveQuality} />
      </div>}
    </div>
  );
}
