import "server-only";
import { Chess } from "chess.js";
import type { EngineConfig } from "@/lib/engine/config";
import type { ChessEngine } from "@/types/engine";

// Explicit synthetic facts: each mover loses 50cp; first legal move is the PV.
// This tests plumbing and classification, not engine strength.
export function createStockfish(config?: EngineConfig): ChessEngine {
  return { async analyze(fen, options) {
    const board = new Chess(fen);
    const move = board.moves({ verbose: true })[0];
    const uci = move ? move.from + move.to + (move.promotion ?? "") : null;
    const variations = config?.multiPv === 3 ? board.moves({ verbose: true }).slice(0, 3).map((move, rank) => ({ depth: 12, score: { kind: "cp" as const, value: 32 - rank * 10, bound: "exact" as const }, pv: [move.lan] })) : undefined;
    const result = {
      perspective: board.turn() === "w" ? "WHITE" as const : "BLACK" as const,
      bestMove: uci,
      evaluation: { depth: 12, score: { kind: "cp" as const, value: 25, bound: "exact" as const }, pv: uci ? [uci] : [] },
      ...(variations ? { variations } : {}),
    };
    options?.onProgress?.(result);
    return result;
  } };
}
