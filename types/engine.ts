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
  /** Ranked root lines, present only when MultiPV was requested. */
  variations?: EngineInfo[];
}
export interface EngineSearchOptions {
  signal?: AbortSignal;
  onProgress?: (result: EngineResult) => void;
  /** Preserve repetition context for manually explored lines. */
  history?: { startFen: string; moves: string[] };
}
export interface ChessEngine {
  analyze(fen: string, options?: EngineSearchOptions): Promise<EngineResult>;
}
