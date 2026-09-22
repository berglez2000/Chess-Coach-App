import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import type { ChessEngine, EngineResult } from "@/types/engine";
import type { ParsedGameMove } from "@/types/game";
import type { MoveAssessment } from "@/types/analysis";
import { assessMove } from "./classify";
import { normalizeEvaluation } from "./evaluation";

export interface AnalysisConfiguration {
  engine: "Stockfish";
  adapterVersion: 1;
  depth: number;
  moveTimeMs: number | null;
  timeoutMs: number;
  threads: 1;
  hashMb: 16;
  multiPv: 1;
}
export interface StoredAssessment {
  runId: string;
  assessment: MoveAssessment;
  bestMoveSan: string | null;
  pvSan: string[];
  configuration: AnalysisConfiguration;
}
export interface AnalysisRepository {
  load(id: string): Promise<{ initialFen: string; moves: (ParsedGameMove & { id: string })[] } | null>;
  claim(id: string): Promise<boolean>;
  save(moveId: string, result: StoredAssessment): Promise<void>;
  complete(id: string): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}
export type AnalysisOutcome =
  | { status: "ENGINE_COMPLETED"; analyzedMoves: number }
  | { status: "FAILED"; code: "ANALYSIS_FAILED" | "STORAGE_FAILED"; message: string }
  | { status: "NOT_FOUND" }
  | { status: "NOT_READY" };
export type EngineFactory = () => { engine: ChessEngine; configuration: AnalysisConfiguration };

/** Validates UCI moves while deriving SAN from the original position, never the played result. */
export function variationToSan(fen: string, moves: string[]): string[] {
  const board = new Chess(fen);
  return moves.map(uci => {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("Invalid engine move.");
    return board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  });
}

async function evaluate(engine: ChessEngine, fen: string): Promise<EngineResult> {
  const board = new Chess(fen);
  const perspective = board.turn() === "w" ? "WHITE" : "BLACK";
  if (board.isCheckmate() || board.isDraw()) {
    return { perspective, bestMove: null, evaluation: { depth: 0, pv: [], score: { kind: board.isCheckmate() ? "mate" : "cp", value: 0, bound: "exact" } } };
  }
  const result = await engine.analyze(fen);
  normalizeEvaluation(result, fen);
  if (!result.bestMove) throw new Error("Missing best move in a nonterminal position.");
  variationToSan(fen, [result.bestMove]);
  if (result.evaluation) variationToSan(fen, result.evaluation.pv);
  return result;
}

export async function analyzeGame(id: string, repository: AnalysisRepository, factory: EngineFactory): Promise<AnalysisOutcome> {
  let claimed = false;
  try {
    const game = await repository.load(id);
    if (!game) return { status: "NOT_FOUND" };
    claimed = await repository.claim(id);
    if (!claimed) return { status: "NOT_READY" };
    const { engine, configuration } = factory();
    if (!game.moves.length) throw new Error("A saved game must contain moves.");
    const runId = randomUUID();
    let fen = game.initialFen;
    let before = await evaluate(engine, fen);
    for (const [index, move] of game.moves.entries()) {
      if (move.ply !== index + 1 || move.fenBefore !== fen) throw new Error("Saved positions are not contiguous.");
      const board = new Chess(fen);
      const played = board.move({ from: move.uci.slice(0, 2), to: move.uci.slice(2, 4), promotion: move.uci[4] });
      if (board.fen() !== move.fenAfter || played.san !== move.san || (played.color === "w" ? "WHITE" : "BLACK") !== move.color) throw new Error("Saved move does not match its position.");
      const after = await evaluate(engine, move.fenAfter);
      const assessment = assessMove({ fenBefore: fen, move: move.uci, before, after });
      await repository.save(move.id, {
        runId, assessment, configuration,
        bestMoveSan: before.bestMove ? variationToSan(fen, [before.bestMove])[0] : null,
        pvSan: variationToSan(fen, before.evaluation?.pv ?? []),
      });
      // Reuse only the adjacent position, retaining its exact FEN and side to move.
      fen = move.fenAfter;
      before = after;
    }
    await repository.complete(id);
    return { status: "ENGINE_COMPLETED", analyzedMoves: game.moves.length };
  } catch {
    const message = "Engine analysis failed. Saved game data and completed move results are retained. Please retry.";
    if (claimed) {
      try { await repository.fail(id, message); }
      catch { return { status: "FAILED", code: "STORAGE_FAILED", message: "Could not record analysis status. Check the database connection before retrying." }; }
    }
    return { status: "FAILED", code: "ANALYSIS_FAILED", message };
  }
}
