"use client";

import { Chessboard } from "react-chessboard";
import type { ChessColor } from "@/types/game";

export function ReplayBoard({ fen, userColor, flipped = false }: { fen: string; userColor: ChessColor; flipped?: boolean }) {
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
        showAnimations: false,
        darkSquareStyle: { backgroundColor: "#779383" },
        lightSquareStyle: { backgroundColor: "#eeeee5" },
      }} />
    </div>
  );
}
