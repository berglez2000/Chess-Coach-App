import { z } from "zod";
import { reviewAssessmentSchema } from "@/lib/analysis/review";
import { selectMoments } from "./select-moments";
import type { ChessColor, ParsedGameMove } from "@/types/game";
import type { MoveAssessment } from "@/types/analysis";

const selectionAssessment = reviewAssessmentSchema.extend({
  rawCpLoss: z.number().nullable(),
  reason: z.enum(["cp_loss", "forced", "checkmate", "missing_evaluation", "bounded_evaluation", "shallow_search", "search_disagreement", "overwhelming_position", "mate_found", "mate_missed", "mate_allowed", "mate_retained", "mate_escaped", "already_losing_mate"]),
  facts: reviewAssessmentSchema.shape.facts.extend({
    fenBefore: z.string(), fenAfter: z.string(), move: z.string(),
    mover: z.enum(["WHITE", "BLACK"]), legalMoveCount: z.number().int().nonnegative(),
    bestMove: z.string().nullable(), terminal: z.enum(["checkmate", "draw"]).nullable(),
  }),
});

/** Recover the existing deterministic selections from validated stored evidence. */
export function positiveHighlightPlies(userColor: ChessColor, moves: (ParsedGameMove & {
  engineAnalysis: { assessment: unknown } | null;
})[]): Set<number> {
  const assessments: { ply: number; assessment: MoveAssessment }[] = [];
  for (const move of moves) {
    const parsed = selectionAssessment.safeParse(move.engineAnalysis?.assessment);
    if (parsed.success) assessments.push({ ply: move.ply, assessment: parsed.data });
  }
  return new Set(selectMoments({ userColor, moves, assessments })
    .filter(moment => moment.kind === "positive").map(moment => moment.ply));
}
