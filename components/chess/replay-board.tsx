"use client";

import { Chessboard } from "react-chessboard";
import type { ChessColor } from "@/types/game";
import { boardTheme, customPieces } from "./board-theme";

export function ReplayBoard({ fen, userColor, flipped = false, lastMove }: { fen: string; userColor: ChessColor; flipped?: boolean; lastMove?: string }) {
  const defaultWhiteBottom = userColor === "WHITE";
  const whiteBottom = flipped ? !defaultWhiteBottom : defaultWhiteBottom;
  return (
    <div className="w-full min-w-0" role="img" aria-label={`Game position, ${whiteBottom ? "White" : "Black"} at the bottom`}>
      <Chessboard options={{
        id: "game-replay",
        position: fen,
        boardOrientation: whiteBottom ? "white" : "black",
        allowDragging: false,
        allowDrawingArrows: false,
        showAnimations: true,
        animationDurationInMs: 200,
        pieces: customPieces,
        boardStyle: { backgroundImage: `url(${boardTheme.boardImage})`, backgroundSize: "100% 100%", borderRadius: "8px", overflow: "hidden" },
        darkSquareStyle: { backgroundColor: "transparent" },
        lightSquareStyle: { backgroundColor: "transparent" },
        darkSquareNotationStyle: { color: boardTheme.darkNotation },
        lightSquareNotationStyle: { color: boardTheme.lightNotation },
        squareStyles: lastMove ? {
          [lastMove.slice(0, 2)]: { backgroundColor: boardTheme.lastMoveFrom },
          [lastMove.slice(2, 4)]: { backgroundColor: boardTheme.lastMoveTo },
        } : {},
      }} />
    </div>
  );
}
