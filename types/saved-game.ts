import type { ChessColor, ParsedGame } from "./game";

export type AnalysisStatus = "PENDING" | "ENGINE_RUNNING" | "ENGINE_COMPLETED" | "AI_RUNNING" | "COMPLETED" | "FAILED";
export type ReviewGame = Pick<ParsedGame, "initialFen" | "metadata" | "moves">;
export interface GameSummary {
  id: string;
  whiteName: string | null;
  blackName: string | null;
  result: string;
  playedAt: string | null;
  openingName: string | null;
  userColor: ChessColor;
  status: AnalysisStatus;
  createdAt: string;
}
export interface SavedGame extends GameSummary {
  analysisError: string | null;
  analysisLeaseUntil: string | null;
  game: ReviewGame;
}
