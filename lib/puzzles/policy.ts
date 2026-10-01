import { Chess } from "chess.js";
import { normalizeEvaluation } from "@/lib/analysis/evaluation";
import { variationToSan } from "@/lib/analysis/orchestrate";
import type { ChessColor } from "@/types/game";
import type { EngineResult } from "@/types/engine";

/** Bump version whenever selection, validation or search settings change. */
export const PUZZLE_POLICY = {
  version: 1, engine: "Stockfish", adapterVersion: 2,
  depth: 14, moveTimeMs: null, timeoutMs: 30000, threads: 1, hashMb: 16, multiPv: 2,
  maxCandidates: 5, minSavedLossCp: 100, minWinningCp: 200, minGapCp: 150,
  maxMateMoves: 5, maxRunnerUpCpForMate: 500,
  alternatives: "unique-best-only", playerMoves: 1,
} as const;

export interface Candidate {
  ply: number; color: ChessColor; fenBefore: string; uci: string;
  engineAnalysis: { runId: string; cpLoss: number | null; classification: string; bestMoveUci: string | null } | null;
}
export interface ValidatedPuzzle {
  sourcePly: number; sourceRunId: string; startingFen: string; playerColor: ChessColor;
  acceptedMoves: string[]; validation: EngineResult;
}

export function selectCandidates(moves: Candidate[], color: ChessColor): Candidate[] {
  return moves.filter(move => move.color === color && move.engineAnalysis &&
    ["mistake", "blunder"].includes(move.engineAnalysis.classification) &&
    (move.engineAnalysis.cpLoss ?? 0) >= PUZZLE_POLICY.minSavedLossCp &&
    move.engineAnalysis.bestMoveUci && move.engineAnalysis.bestMoveUci !== move.uci)
    .sort((a, b) => b.engineAnalysis!.cpLoss! - a.engineAnalysis!.cpLoss! || a.ply - b.ply)
    .slice(0, PUZZLE_POLICY.maxCandidates);
}

/** Conservative policy: reject weak, incomplete, bounded, or ambiguous results. */
export function validatePuzzle(candidate: Candidate, result: EngineResult): ValidatedPuzzle | null {
  const board = new Chess(candidate.fenBefore);
  if (board.isGameOver() || (board.turn() === "w" ? "WHITE" : "BLACK") !== candidate.color) return null;
  variationToSan(candidate.fenBefore, [candidate.uci]);
  normalizeEvaluation(result, candidate.fenBefore);
  const lines = result.variations;
  if (!lines || lines.length !== 2 || !result.bestMove || !result.evaluation) return null;
  const [best, runner] = lines;
  if (best.depth !== runner.depth || best.depth < PUZZLE_POLICY.depth ||
    lines.some(line => line.score.bound !== "exact" || !line.pv.length) ||
    best.pv[0] !== result.bestMove || best.pv[0] === runner.pv[0] ||
    result.bestMove === candidate.uci || result.bestMove !== candidate.engineAnalysis?.bestMoveUci ||
    JSON.stringify(best) !== JSON.stringify(result.evaluation)) return null;
  for (const line of lines) {
    normalizeEvaluation({ ...result, evaluation: line }, candidate.fenBefore);
    variationToSan(candidate.fenBefore, line.pv);
  }
  const first = best.score;
  const second = runner.score;
  const clearWin = first.kind === "cp" && first.value >= PUZZLE_POLICY.minWinningCp &&
    (second.kind === "cp" ? first.value - second.value >= PUZZLE_POLICY.minGapCp : second.value < 0);
  const clearMate = first.kind === "mate" && first.value > 0 && first.value <= PUZZLE_POLICY.maxMateMoves &&
    (second.kind === "cp" ? second.value <= PUZZLE_POLICY.maxRunnerUpCpForMate : second.value < 0);
  if (!clearWin && !clearMate) return null;
  return { sourcePly: candidate.ply, sourceRunId: candidate.engineAnalysis!.runId,
    startingFen: candidate.fenBefore, playerColor: candidate.color,
    acceptedMoves: [result.bestMove], validation: result };
}
