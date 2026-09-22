import { Chess } from "chess.js";
import type { EngineResult } from "@/types/engine";
import type { MoveAssessment, MoveQuality } from "@/types/analysis";
import { normalizeEvaluation } from "./evaluation";

export const CLASSIFICATION_POLICY = { version: 1, minDepth: 8, inaccuracyCp: 20, mistakeCp: 50, blunderCp: 100, overwhelmingCp: 800 } as const;

/** Pure classification: retain normalized facts for later persistence/reclassification. */
export function assessMove(input: { fenBefore: string; move: string; before: EngineResult; after: EngineResult }): MoveAssessment {
  const board = new Chess(input.fenBefore);
  const mover = board.turn() === "w" ? "WHITE" : "BLACK";
  const legal = board.moves({ verbose: true });
  const played = legal.find(move => move.from + move.to + (move.promotion ?? "") === input.move);
  if (!played) throw new Error("The assessed move must be legal in the starting position.");
  board.move(played);
  const fenAfter = board.fen();
  const before = normalizeEvaluation(input.before, input.fenBefore);
  const after = normalizeEvaluation(input.after, fenAfter);
  const terminal = board.isCheckmate() ? "checkmate" : board.isDraw() ? "draw" : null;
  const facts: MoveAssessment["facts"] = { fenBefore: input.fenBefore, fenAfter, move: input.move, mover,
    legalMoveCount: legal.length, bestMove: input.before.bestMove, before, after, terminal };
  const result = (quality: MoveQuality, reason: MoveAssessment["reason"], rawCpLoss: number | null = null): MoveAssessment => ({
    policyVersion: 1, quality, reason, rawCpLoss, cpLoss: rawCpLoss === null ? null : Math.max(0, rawCpLoss), facts,
  });
  // Board facts establish these cases independently of engine confidence.
  if (terminal === "checkmate") return result("normal", "checkmate");
  if (legal.length === 1) return result("normal", "forced");
  if (!before || (!after && terminal !== "draw")) return result("unknown", "missing_evaluation");
  if (before.score.bound !== "exact" || (terminal !== "draw" && after?.score.bound !== "exact")) return result("unknown", "bounded_evaluation");
  if (before.depth < CLASSIFICATION_POLICY.minDepth || (terminal !== "draw" && after!.depth < CLASSIFICATION_POLICY.minDepth)) return result("unknown", "shallow_search");
  const previous = before.score;
  // A terminal board draw is an exact result, not an engine estimate.
  const next = terminal === "draw" ? { kind: "cp" as const, value: 0 } : after!.score;
  if (previous.kind === "mate" || next.kind === "mate") {
    const wasWinning = previous.kind === "mate" && previous.winner === mover;
    const wasLosing = previous.kind === "mate" && previous.winner !== mover;
    const nowWinning = next.kind === "mate" && next.winner === mover;
    const nowLosing = next.kind === "mate" && next.winner !== mover;
    if (wasWinning && nowWinning) return result("normal", "mate_retained");
    if (wasWinning) return result("blunder", "mate_missed");
    if (nowLosing) return wasLosing ? result("normal", "already_losing_mate") : result("blunder", "mate_allowed");
    if (nowWinning) return result("normal", "mate_found");
    return result("normal", "mate_escaped");
  }
  const sign = mover === "WHITE" ? 1 : -1;
  const rawLoss = previous.value === next.value ? 0 : sign * (previous.value - next.value);
  // Independently searched positions can disagree; preserve the discrepancy.
  if (rawLoss < 0) return result("normal", "search_disagreement", rawLoss);
  if (input.before.bestMove === input.move && rawLoss >= CLASSIFICATION_POLICY.inaccuracyCp) return result("unknown", "search_disagreement", rawLoss);
  let quality: MoveQuality = rawLoss < CLASSIFICATION_POLICY.inaccuracyCp ? "normal" : rawLoss < CLASSIFICATION_POLICY.mistakeCp ? "inaccuracy" : rawLoss < CLASSIFICATION_POLICY.blunderCp ? "mistake" : "blunder";
  if (rawLoss >= CLASSIFICATION_POLICY.mistakeCp && Math.sign(previous.value) === Math.sign(next.value) && Math.abs(previous.value) >= CLASSIFICATION_POLICY.overwhelmingCp && Math.abs(next.value) >= CLASSIFICATION_POLICY.overwhelmingCp) {
    quality = "inaccuracy";
    return result(quality, "overwhelming_position", rawLoss);
  }
  return result(quality, "cp_loss", rawLoss);
}
