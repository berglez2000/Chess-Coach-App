import "server-only";
import { Chess } from "chess.js";
import type { ChessEngine } from "@/types/engine";

// Explicit synthetic facts: each mover loses 50cp; first legal move is the PV.
// This tests plumbing and classification, not engine strength.
export function createStockfish(): ChessEngine {
  return { async analyze(fen) {
    const board = new Chess(fen);
    const move = board.moves({ verbose: true })[0];
    const uci = move ? move.from + move.to + (move.promotion ?? "") : null;
    return {
      perspective: board.turn() === "w" ? "WHITE" : "BLACK",
      bestMove: uci,
      evaluation: { depth: 12, score: { kind: "cp", value: 25, bound: "exact" }, pv: uci ? [uci] : [] },
    };
  } };
}
