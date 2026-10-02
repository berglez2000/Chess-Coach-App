import { Chess } from "chess.js";
import { z } from "zod";
import type { PuzzleSolution } from "@/types/puzzle";

const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
const schema = z.object({ version: z.literal(1), maxPlayerMoves: z.literal(3), lines: z.array(z.object({
  moves: z.array(uci).min(1).max(5), goal: z.enum(["mate", "terminal", "validated-boundary"]),
}).strict()).min(1).max(16) }).strict();

export function playUci(board: Chess, move: string) {
  if (board.isGameOver()) throw new Error("Terminal puzzle position.");
  const played = board.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
  if (played.from + played.to + (played.promotion ?? "") !== move) throw new Error("Invalid move coordinates.");
  return { uci: move, san: played.san, fen: board.fen() };
}

/** Validate every branch independently, and require one deterministic reply per prefix. */
export function readSolution(value: unknown, fen: string, acceptedMoves: string[], playerColor: string): PuzzleSolution | null {
  if (value == null) return null;
  const solution = schema.parse(value);
  const replies = new Map<string, string>();
  const roots = new Set<string>();
  const endings = new Set<string>();
  for (const line of solution.lines) {
    if (line.moves.length % 2 !== 1) throw new Error("Sequence must end on a solver move.");
    const board = new Chess(fen);
    if ((board.turn() === "w" ? "WHITE" : "BLACK") !== playerColor) throw new Error("Wrong solver color.");
    roots.add(line.moves[0]);
    for (let index = 0; index < line.moves.length; index++) {
      const prefix = JSON.stringify(line.moves.slice(0, index));
      if (endings.has(prefix)) throw new Error("Inconsistent sequence boundary.");
      if (index % 2 === 1) {
        if (replies.has(prefix) && replies.get(prefix) !== line.moves[index]) throw new Error("Conflicting opponent replies.");
        replies.set(prefix, line.moves[index]);
      }
      playUci(board, line.moves[index]);
    }
    if (line.goal === "mate" ? !board.isCheckmate() : line.goal === "terminal" ? !board.isGameOver() : board.isGameOver()) {
      throw new Error("Sequence goal does not match its final position.");
    }
    const ending = JSON.stringify(line.moves);
    if (endings.has(ending)) throw new Error("Duplicate solution branch.");
    endings.add(ending);
  }
  for (const line of solution.lines) {
    for (let index = 1; index < line.moves.length; index++) {
      if (endings.has(JSON.stringify(line.moves.slice(0, index)))) throw new Error("Inconsistent sequence boundary.");
    }
  }
  if (roots.size !== acceptedMoves.length || acceptedMoves.some(move => !roots.has(move))) throw new Error("Solution roots do not match accepted moves.");
  return solution;
}

export function replay(fen: string, moves: string[]) {
  const board = new Chess(fen);
  const history = moves.map(move => playUci(board, move));
  return { board, history };
}
