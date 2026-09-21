"use client";

import { Chessboard } from "react-chessboard";
import type { ChessColor } from "@/types/game";

export function ReplayBoard({ fen, userColor }: { fen: string; userColor: ChessColor }) {
  return (
    <div className="w-full min-w-0" role="img" aria-label={`Game position, ${userColor === "WHITE" ? "White" : "Black"} at the bottom`}>
      <Chessboard options={{
        id: "game-replay",
        position: fen,
        boardOrientation: userColor === "WHITE" ? "white" : "black",
        allowDragging: false,
        allowDrawingArrows: false,
        showAnimations: false,
        darkSquareStyle: { backgroundColor: "#779383" },
        lightSquareStyle: { backgroundColor: "#eeeee5" },
      }} />
    </div>
  );
}
