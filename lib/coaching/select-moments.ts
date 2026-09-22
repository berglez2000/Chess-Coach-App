import type { ChessColor, ParsedGameMove } from "@/types/game";
import type { MoveAssessment, WhiteScore } from "@/types/analysis";

export interface MomentEvidence {
  code: "evaluation_loss" | "advantage_reversed" | "mate_missed" | "mate_allowed" | "mate_found" | "mate_escaped" | "checkmate_delivered";
  cpLoss: number | null;
  before: WhiteScore | null;
  after: WhiteScore | null;
}
export interface SelectedMoment {
  ply: number;
  san: string;
  mover: ChessColor;
  kind: "user_loss" | "positive" | "opponent_context";
  evidence: MomentEvidence[];
}
export interface MomentInput {
  userColor: ChessColor;
  moves: ParsedGameMove[];
  assessments: { ply: number; assessment: MoveAssessment }[];
  limit?: number;
}
interface Candidate extends SelectedMoment { severity: number; loss: number }

/** Deterministic selection only: no coaching wording, tactical inference, or engine calls. */
export function selectMoments({ userColor, moves, assessments, limit = 8 }: MomentInput): SelectedMoment[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error("Moment limit must be an integer from 1 to 10.");
  const moveCounts = new Map<number, number>();
  const assessmentCounts = new Map<number, number>();
  for (const move of moves) moveCounts.set(move.ply, (moveCounts.get(move.ply) ?? 0) + 1);
  for (const item of assessments) assessmentCounts.set(item.ply, (assessmentCounts.get(item.ply) ?? 0) + 1);
  const known = new Map(moves.map(move => [move.ply, move]));
  const candidates: Candidate[] = [];
  for (const { ply, assessment: a } of assessments) {
    const move = known.get(ply);
    if (!move || !Number.isInteger(ply) || ply < 1 || moveCounts.get(ply) !== 1 || assessmentCounts.get(ply) !== 1 || a.policyVersion !== 1) continue;
    const facts = a.facts;
    if (facts.move !== move.uci || facts.mover !== move.color || facts.fenBefore !== move.fenBefore || facts.fenAfter !== move.fenAfter) continue;
    if (a.quality === "unknown" || facts.legalMoveCount <= 1 || a.reason === "overwhelming_position" || a.reason === "search_disagreement") continue;
    const before = facts.before;
    const after = facts.after;
    // Only checkmate is a positive signal independent of search depth.
    const checkmate = a.reason === "checkmate" && facts.terminal === "checkmate";
    if (!checkmate && (!before || !after || before.score.bound !== "exact" || after.score.bound !== "exact" || before.depth < 8 || (after.depth < 8 && facts.terminal !== "draw"))) continue;
    const evidence: MomentEvidence[] = [];
    const add = (code: MomentEvidence["code"], cpLoss: number | null = null) => evidence.push({
      code, cpLoss, before: before ? { ...before.score } : null, after: after ? { ...after.score } : null,
    });
    let severity = 0;
    let loss = 0;
    let positive = false;
    if (a.reason === "mate_missed" || a.reason === "mate_allowed") {
      add(a.reason); severity = 3;
    } else if (checkmate || a.reason === "mate_found" || a.reason === "mate_escaped") {
      add(checkmate ? "checkmate_delivered" : a.reason as "mate_found" | "mate_escaped");
      positive = true; severity = checkmate ? 3 : a.reason === "mate_found" ? 2 : 1;
    } else if (["inaccuracy", "mistake", "blunder"].includes(a.quality) && a.cpLoss !== null && Number.isFinite(a.cpLoss) && a.cpLoss >= 20) {
      loss = a.cpLoss; add("evaluation_loss", loss);
      const sign = move.color === "WHITE" ? 1 : -1;
      if (before?.score.kind === "cp" && after?.score.kind === "cp" && sign * before.score.value >= 100 && sign * after.score.value <= -100) {
        add("advantage_reversed", loss); severity = 2;
      } else severity = 1;
    } else continue;
    // Opponent successes are not user highlights; opponent losses can explain opportunities.
    if (positive && move.color !== userColor) continue;
    candidates.push({ ply, san: move.san, mover: move.color,
      kind: positive ? "positive" : move.color === userColor ? "user_loss" : "opponent_context", evidence, severity, loss });
  }
  const rank = (a: Candidate, b: Candidate) => b.severity - a.severity || b.loss - a.loss || a.ply - b.ply;
  const losses = candidates.filter(item => item.kind === "user_loss").sort(rank);
  const positives = candidates.filter(item => item.kind === "positive").sort(rank);
  const opponents = candidates.filter(item => item.kind === "opponent_context").sort(rank);
  const selected: Candidate[] = [];
  const take = (pool: Candidate[], count: number) => {
    let added = 0;
    for (const candidate of pool) {
      if (selected.length >= limit || added >= count) break;
      // A two-ply exclusion window avoids selecting both sides of one short sequence.
      if (selected.some(item => Math.abs(item.ply - candidate.ply) <= 2)) continue;
      selected.push(candidate); added++;
    }
  };
  // Reserve room for other evidence when available, then fill remaining room with user losses.
  take(losses, Math.max(1, limit - Number(positives.length > 0) - Number(opponents.length > 0)));
  take(positives, 2);
  take(opponents, 2);
  take(losses, limit);
  return selected.sort((a, b) => a.ply - b.ply).map(({ ply, san, mover, kind, evidence }) => ({ ply, san, mover, kind, evidence }));
}
