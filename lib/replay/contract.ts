import { z } from "zod";
import type { PuzzleState, SolverPuzzle } from "@/types/puzzle";
import { puzzleActionSchema } from "@/lib/puzzles/solve";

export const startReplaySchema = z.object({ requestId: z.uuid(), gameId: z.string().min(1).max(100).optional() }).strict();
export const replayActionSchema = z.union([
  puzzleActionSchema,
  z.object({ requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646), action: z.enum(["NEXT", "SKIP"]) }).strict(),
]);
export type ReplayAction = z.infer<typeof replayActionSchema>;
export type ReplayComparison = { original: { uci: string; san: string; fen: string }; firstAttempt: { uci: string; san: string; fen: string } | null;
  explanation: string | null; lesson: string | null; gameId: string; sourcePly: number };
export type ReplayDto = { id: string; revision: number; index: number; total: number; completed: boolean; restartGameId: string | null;
  puzzle: SolverPuzzle | null; comparison: ReplayComparison | null; mistakes: number;
  results: { firstTry: number; retried: number; assisted: number; revealed: number; skipped: number } };
export function replayOutcome(progress: PuzzleState, mistakes: number, skipped: boolean) {
  if (skipped) return "skipped" as const;
  if (progress.state === "REVEALED") return "revealed" as const;
  if (progress.state !== "SOLVED") return null;
  if (progress.assisted) return "assisted" as const;
  return mistakes ? "retried" as const : "firstTry" as const;
}
