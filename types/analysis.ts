import type { ChessColor } from "./game";
import type { EngineScore } from "./engine";

export type WhiteScore =
  | { kind: "cp"; value: number; bound: EngineScore["bound"] }
  | { kind: "mate"; value: number; winner: ChessColor; bound: EngineScore["bound"] };
export interface NormalizedEvaluation {
  perspective: "WHITE";
  score: WhiteScore;
  depth: number;
  pv: string[];
}
export type MoveQuality = "normal" | "inaccuracy" | "mistake" | "blunder" | "unknown";
export interface MoveAssessment {
  policyVersion: 1;
  quality: MoveQuality;
  reason: "cp_loss" | "forced" | "checkmate" | "missing_evaluation" | "bounded_evaluation" | "shallow_search" | "search_disagreement" | "overwhelming_position" | "mate_found" | "mate_missed" | "mate_allowed" | "mate_retained" | "mate_escaped" | "already_losing_mate";
  /** Never assign centipawns to mate scores. Negative search discrepancies clamp to zero. */
  cpLoss: number | null;
  rawCpLoss: number | null;
  facts: {
    fenBefore: string;
    fenAfter: string;
    move: string;
    mover: ChessColor;
    legalMoveCount: number;
    bestMove: string | null;
    before: NormalizedEvaluation | null;
    after: NormalizedEvaluation | null;
    terminal: "checkmate" | "draw" | null;
  };
}
