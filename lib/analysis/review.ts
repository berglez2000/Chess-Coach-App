import { z } from "zod";
import type { NormalizedEvaluation, MoveQuality } from "@/types/analysis";

const bound = z.enum(["exact", "lower", "upper"]);
const score = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cp"), value: z.number().int(), bound }),
  z.object({ kind: z.literal("mate"), value: z.number().int(), winner: z.enum(["WHITE", "BLACK"]), bound }),
]);
const evaluation = z.object({ perspective: z.literal("WHITE"), score, depth: z.number().int().nonnegative(), pv: z.array(z.string()) });
const assessment = z.object({
  policyVersion: z.literal(1), quality: z.enum(["normal", "inaccuracy", "mistake", "blunder", "unknown"]),
  reason: z.string(), cpLoss: z.number().nullable(),
  facts: z.object({ before: evaluation.nullable(), after: evaluation.nullable() }),
});
export interface ReviewAnalysis {
  before: NormalizedEvaluation | null;
  after: NormalizedEvaluation | null;
  quality: MoveQuality;
  reason: string;
  cpLoss: number | null;
  bestMoveSan: string | null;
  pvSan: string[];
  runId: string;
  analyzedAt: string;
}

/** Validate persisted versioned JSON rather than exposing an unchecked database cast. */
export function toReviewAnalysis(row: { assessment: unknown; bestMoveSan: string | null; pvSan: string[]; runId: string; analyzedAt: Date } | null): ReviewAnalysis | null {
  if (!row) return null;
  const parsed = assessment.safeParse(row.assessment);
  if (!parsed.success) return null;
  const value = parsed.data;
  return { before: value.facts.before, after: value.facts.after, quality: value.quality,
    reason: value.reason, cpLoss: value.cpLoss, bestMoveSan: row.bestMoveSan,
    pvSan: row.pvSan, runId: row.runId, analyzedAt: row.analyzedAt.toISOString() };
}
