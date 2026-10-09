import type { ChessColor } from "./game";

export interface PuzzleState {
  revision: number;
  state: "SOLVING" | "SOLVED" | "REVEALED";
  assisted: boolean;
  hintUsed: boolean;
  solvedMove: string | null;
  playedMoves: string[];
  lastOutcome: string | null;
  moveAttempts: number;
  completedAt: string | null;
  completionAssisted: boolean | null;
}
export interface SolverPuzzle {
  learning?: { type?: "MOVE" | "MISSING_PIECE"; placementPiece?: "p" | "n" | "b" | "r" | "q"; revisionId: string; objective: string; prompt: string; hint: string | null; publishedSolution: string | null; explanation: string | null };
  id: string;
  startingFen: string;
  playerColor: ChessColor;
  gameId: string;
  sourcePly: number;
  currentFen: string;
  history: { uci: string; san: string; fen: string }[];
  maxPlayerMoves: number;
  progress: Omit<PuzzleState, "hintUsed" | "solvedMove">;
  hintSquare: string | null;
  solution: { uci: string; san: string; fen: string } | null;
  solutionLine: { uci: string; san: string; fen: string }[] | null;
  goal: "mate" | "terminal" | "validated-boundary" | null;
}
export interface PuzzleSolution {
  version: 1 | 2;
  maxPlayerMoves: 3 | 4;
  lines: { moves: string[]; goal: "mate" | "terminal" | "validated-boundary" }[];
}
export type PuzzleAction = {
  requestId: string;
  expectedRevision: number;
} & ({ action: "MOVE"; move: string } | { action: "HINT" | "REVEAL" | "RETRY" });
