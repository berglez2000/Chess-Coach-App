import type { ChessColor } from "./game";

export type EngineScore = { kind: "cp" | "mate"; value: number; bound: "exact" | "lower" | "upper" };
export interface EngineInfo {
  depth: number;
  score: EngineScore;
  pv: string[];
}
export interface EngineResult {
  /** UCI scores are relative to the side to move in the requested FEN. */
  perspective: ChessColor;
  bestMove: string | null;
  evaluation: EngineInfo | null;
}
export interface ChessEngine {
  analyze(fen: string): Promise<EngineResult>;
}
