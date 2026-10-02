import { Chess } from "chess.js";
import { normalizeEvaluation } from "@/lib/analysis/evaluation";
import { variationToSan } from "@/lib/analysis/orchestrate";
import type { ChessColor } from "@/types/game";
import type { EngineResult } from "@/types/engine";
import type { PuzzleSolution } from "@/types/puzzle";
import type { ChessEngine } from "@/types/engine";
import { playUci, readSolution, replay } from "./sequence";

/** Bump version whenever selection, validation or search settings change. */
export const PUZZLE_POLICY = {
  version: 2, engine: "Stockfish", adapterVersion: 2,
  depth: 14, moveTimeMs: null, timeoutMs: 30000, threads: 1, hashMb: 16, multiPv: 2,
  maxCandidates: 5, minSavedLossCp: 100, minWinningCp: 200, minGapCp: 150,
  maxMateMoves: 5, maxRunnerUpCpForMate: 500,
  alternatives: "unique-best-only", playerMoves: 3,
  replies: "precomputed-best-exact-depth-14", boundary: "last-validated-solver-move",
} as const;

export interface Candidate {
  ply: number; color: ChessColor; fenBefore: string; uci: string;
  engineAnalysis: { runId: string; cpLoss: number | null; classification: string; bestMoveUci: string | null } | null;
}
export interface ValidatedPuzzle {
  sourcePly: number; sourceRunId: string; startingFen: string; playerColor: ChessColor;
  acceptedMoves: string[]; validation: EngineResult & { continuations?: { fen: string; result: EngineResult }[] };
  solution?: PuzzleSolution;
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
  if (result.bestMove === candidate.uci || result.bestMove !== candidate.engineAnalysis?.bestMoveUci) return null;
  const bestMove = winningRoot(candidate.fenBefore, result);
  if (!bestMove) return null;
  return { sourcePly: candidate.ply, sourceRunId: candidate.engineAnalysis!.runId,
    startingFen: candidate.fenBefore, playerColor: candidate.color,
    acceptedMoves: [bestMove], validation: result };
}

/** Fresh searches validate the actual branch position, never a transplanted PV. */
export function exactRoot(fen: string, result: EngineResult): string | null {
  normalizeEvaluation(result, fen);
  const lines = result.variations;
  if (!result.bestMove || !result.evaluation || !lines?.length || lines.length > 2 ||
    lines.length !== Math.min(2, new Chess(fen).moves().length) ||
    JSON.stringify(lines[0]) !== JSON.stringify(result.evaluation) || lines[0].pv[0] !== result.bestMove ||
    new Set(lines.map(line => line.pv[0])).size !== lines.length ||
    lines.some(line => line.depth < PUZZLE_POLICY.depth || line.depth !== lines[0].depth || line.score.bound !== "exact" || !line.pv.length)) return null;
  for (const line of lines) {
    normalizeEvaluation({ ...result, evaluation: line }, fen);
    replay(fen, line.pv);
  }
  return result.bestMove;
}

export function winningRoot(fen: string, result: EngineResult, allowForced = false): string | null {
  if (!exactRoot(fen, result)) return null;
  const lines = result.variations;
  if (!lines) return null;
  const [best, runner] = lines;
  const first = best.score;
  if (!runner) {
    return allowForced && new Chess(fen).moves().length === 1 &&
      (first.kind === "cp" ? first.value >= PUZZLE_POLICY.minWinningCp : first.value > 0 && first.value <= PUZZLE_POLICY.maxMateMoves)
      ? result.bestMove : null;
  }
  const second = runner.score;
  const clearWin = first.kind === "cp" && first.value >= PUZZLE_POLICY.minWinningCp &&
    (second.kind === "cp" ? first.value - second.value >= PUZZLE_POLICY.minGapCp : second.value < 0);
  const clearMate = first.kind === "mate" && first.value > 0 && first.value <= PUZZLE_POLICY.maxMateMoves &&
    (second.kind === "cp" ? second.value <= PUZZLE_POLICY.maxRunnerUpCpForMate : second.value < 0);
  return clearWin || clearMate ? result.bestMove : null;
}

export async function extendPuzzle(puzzle: ValidatedPuzzle, engine: ChessEngine, renew: () => Promise<void>): Promise<ValidatedPuzzle> {
  const board = new Chess(puzzle.startingFen);
  const moves = [puzzle.acceptedMoves[0]];
  const continuations: { fen: string; result: EngineResult }[] = [];
  playUci(board, moves[0]);
  while (!board.isGameOver() && moves.length < PUZZLE_POLICY.playerMoves * 2 - 1) {
    await renew();
    const opponentFen = board.fen();
    const opponent = await engine.analyze(opponentFen);
    continuations.push({ fen: opponentFen, result: opponent });
    const reply = exactRoot(opponentFen, opponent);
    if (!reply) break;
    const next = replay(puzzle.startingFen, moves).board;
    playUci(next, reply);
    // End at the last validated solver position if a continuation cannot qualify.
    if (next.isGameOver()) break;
    await renew();
    const solverFen = next.fen();
    const assessment = await engine.analyze(solverFen);
    continuations.push({ fen: solverFen, result: assessment });
    const move = winningRoot(solverFen, assessment, true);
    if (!move) break;
    playUci(board, reply);
    playUci(board, move);
    moves.push(reply, move);
  }
  const goal = board.isCheckmate() ? "mate" : board.isGameOver() ? "terminal" : "validated-boundary";
  const solution: PuzzleSolution = { version: 1, maxPlayerMoves: 3, lines: [{ moves, goal }] };
  readSolution(solution, puzzle.startingFen, puzzle.acceptedMoves, puzzle.playerColor);
  return { ...puzzle, solution, validation: { ...puzzle.validation, continuations } };
}
