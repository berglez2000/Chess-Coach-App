import type { ChessColor } from "./game";

export interface PuzzleState {
  revision: number;
  state: "SOLVING" | "SOLVED" | "REVEALED";
  assisted: boolean;
  hintUsed: boolean;
  solvedMove: string | null;
  lastOutcome: string | null;
  moveAttempts: number;
  completedAt: string | null;
  completionAssisted: boolean | null;
}
export interface SolverPuzzle {
  id: string;
  startingFen: string;
  playerColor: ChessColor;
  gameId: string;
  sourcePly: number;
  progress: Omit<PuzzleState, "hintUsed" | "solvedMove">;
  hintSquare: string | null;
  solution: { uci: string; san: string; fen: string } | null;
}
export type PuzzleAction = {
  requestId: string;
  expectedRevision: number;
} & ({ action: "MOVE"; move: string } | { action: "HINT" | "REVEAL" | "RETRY" });
