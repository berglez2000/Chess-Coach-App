import { Chess } from "chess.js";
import { isIncompleteMove } from "@/lib/chesslink/recording";
export function physicalMove(fen: string, placement: string) {
  const board = new Chess(fen);
  if (placement === fen.split(" ")[0]) return { kind: "same" } as const;
  const moves = board.moves({ verbose: true }).filter(move => move.after.split(" ")[0] === placement);
  if (moves.length === 1) return { kind: "move", uci: moves[0].lan } as const;
  if (isIncompleteMove([], placement, fen)) return { kind: "incomplete" } as const;
  return { kind: "mismatch" } as const;
}

export function differingSquares(actual: string, targetFen: string): string[] {
  const target = new Chess(targetFen);
  const board = new Chess(`${actual} ${target.turn()} - - 0 1`, { skipValidation: true });
  const squares: string[] = [];
  for (let rank = 1; rank <= 8; rank++) for (const file of "abcdefgh") {
    const square = `${file}${rank}` as Parameters<typeof target.get>[0];
    const first = board.get(square); const second = target.get(square);
    if (first?.type !== second?.type || first?.color !== second?.color) squares.push(square);
  }
  return squares;
}
