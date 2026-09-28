import type { CoachingProvider } from "@/lib/coaching/providers";
import type { ReviewAnalysis } from "@/lib/analysis/review";
import type { CoachingCategory, CoachingClassification } from "@/lib/coaching/contract";
import type { ChessColor, ParsedGame, ParsedGameMove } from "./game";

export type AnalysisStatus = "PENDING" | "ENGINE_RUNNING" | "ENGINE_COMPLETED" | "AI_RUNNING" | "COMPLETED" | "FAILED";

export interface ReviewCoachingAnnotation {
  classification: CoachingClassification;
  headline: string | null;
  explanation: string;
  lesson: string;
  category: CoachingCategory;
  model: string;
  provider: CoachingProvider;
}

export interface GameCoachingSummary {
  summary: string;
  strengths: string[];
  improvements: string[];
  model: string;
  provider: CoachingProvider;
}

export type ReviewGame = Pick<ParsedGame, "initialFen" | "metadata"> & {
  moves: (ParsedGameMove & { positiveHighlight?: boolean; analysis?: ReviewAnalysis | null; coaching?: ReviewCoachingAnnotation | null })[];
  coaching?: GameCoachingSummary | null;
};

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
  coachingRevision: number;
  analysisError: string | null;
  analysisLeaseUntil: string | null;
  game: ReviewGame;
}
