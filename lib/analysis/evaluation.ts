import { Chess } from "chess.js";
import type { EngineResult } from "@/types/engine";
import type { NormalizedEvaluation, WhiteScore } from "@/types/analysis";

export function normalizeEvaluation(result: EngineResult, fen: string): NormalizedEvaluation | null {
  const board = new Chess(fen);
  const side = board.turn() === "w" ? "WHITE" : "BLACK";
  if (side !== result.perspective) throw new Error("Engine perspective does not match the position.");
  if (!result.evaluation) return null;
  const { score, depth, pv } = result.evaluation;
  if (!Number.isSafeInteger(score.value) || !Number.isInteger(depth) || depth < 0) throw new Error("Invalid engine evaluation.");
  const value = score.value === 0 ? 0 : side === "WHITE" ? score.value : -score.value;
  const bound = side === "WHITE" || score.bound === "exact" ? score.bound : score.bound === "lower" ? "upper" : "lower";
  let normalized: WhiteScore;
  if (score.kind === "mate") {
    if (score.value === 0 && !board.isCheckmate()) throw new Error("Mate zero requires a checkmated position.");
    const winner = score.value > 0 ? side : side === "WHITE" ? "BLACK" : "WHITE";
    normalized = { kind: "mate", value, bound, winner };
  } else normalized = { kind: "cp", value, bound };
  return { perspective: "WHITE", score: normalized, depth, pv: [...pv] };
}
