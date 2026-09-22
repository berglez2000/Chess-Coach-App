import { Chess } from "chess.js";
import { expect, it } from "vitest";
import { normalizeEvaluation } from "@/lib/analysis/evaluation";
import { assessMove } from "@/lib/analysis/classify";
import type { EngineResult, EngineScore } from "@/types/engine";
const initial = new Chess().fen();
function engine(perspective: "WHITE" | "BLACK", value: number, kind: "cp" | "mate" = "cp", bound: EngineScore["bound"] = "exact", depth = 12): EngineResult {
  return { perspective, bestMove: null, evaluation: { score: { kind, value, bound }, depth, pv: [] } };
}
function assess(before: number, after: number, black = false) {
  const board = new Chess(); if (black) board.move("e4");
  return assessMove({ fenBefore: board.fen(), move: black ? "e7e5" : "e2e4", before: engine(black ? "BLACK" : "WHITE", before), after: engine(black ? "WHITE" : "BLACK", -after) });
}
it.each([false, true])("computes mover loss for both colors (%#)", black => {
  for (const [loss, quality] of [[0, "normal"], [19, "normal"], [20, "inaccuracy"], [49, "inaccuracy"], [50, "mistake"], [99, "mistake"], [100, "blunder"], [250, "blunder"]] as const) {
    const result = assess(100, 100 - loss, black);
    expect(result).toMatchObject({ quality, cpLoss: loss, rawCpLoss: loss });
    expect(result.facts.before?.perspective).toBe("WHITE");
    expect(result.facts.after?.score.value).toBe(black ? loss - 100 : 100 - loss);
  }
});
it("negates Black scores and reverses bounds", () => {
  const board = new Chess(); board.move("e4");
  expect(normalizeEvaluation(engine("BLACK", 42, "cp", "lower"), board.fen())?.score).toEqual({ kind: "cp", value: -42, bound: "upper" });
  expect(normalizeEvaluation(engine("BLACK", -3, "mate", "upper"), board.fen())?.score).toEqual({ kind: "mate", value: 3, winner: "WHITE", bound: "lower" });
});
it("retains raw negative apparent loss without claiming a negative penalty", () => {
  expect(assess(0, 30)).toMatchObject({ quality: "normal", reason: "search_disagreement", cpLoss: 0, rawCpLoss: -30 });
});
it("caps large losses only when both positions remain overwhelmingly on the same side", () => {
  expect(assess(1200, 900)).toMatchObject({ quality: "inaccuracy", reason: "overwhelming_position", cpLoss: 300 });
  expect(assess(-900, -1200)).toHaveProperty("quality", "inaccuracy");
  expect(assess(900, 799)).toHaveProperty("quality", "blunder");
  expect(assess(900, -900)).toHaveProperty("quality", "blunder");
});
it.each([false, true])("handles mate found, missed, allowed, retained and escaped for each mover (%#)", black => {
  const board = new Chess(); if (black) board.move("e4");
  const mover = black ? "BLACK" : "WHITE";
  const opponent = black ? "WHITE" : "BLACK";
  const cases = [
    ["cp", 10, "mate", 3, "mate_found", "normal"],
    ["mate", 3, "cp", 900, "mate_missed", "blunder"],
    ["cp", 10, "mate", -3, "mate_allowed", "blunder"],
    ["mate", 3, "mate", 8, "mate_retained", "normal"],
    ["mate", -3, "mate", -1, "already_losing_mate", "normal"],
    ["mate", -3, "cp", -100, "mate_escaped", "normal"],
    ["mate", 3, "mate", -3, "mate_missed", "blunder"],
  ] as const;
  for (const [bk, bv, ak, av, reason, quality] of cases) {
    const result = assessMove({ fenBefore: board.fen(), move: black ? "e7e5" : "e2e4", before: engine(mover, bv, bk), after: engine(opponent, -av, ak) });
    expect(result).toMatchObject({ reason, quality, cpLoss: null, rawCpLoss: null });
  }
});
it("leaves missing, bound-only and shallow evaluations unclassified", () => {
  const input = { fenBefore: initial, move: "e2e4", before: engine("WHITE", 100), after: engine("BLACK", 100) };
  expect(assessMove({ ...input, after: { ...input.after, evaluation: null } })).toMatchObject({ quality: "unknown", cpLoss: null, reason: "missing_evaluation" });
  expect(assessMove({ ...input, before: engine("WHITE", 100, "cp", "lower") })).toMatchObject({ quality: "unknown", cpLoss: null, reason: "bounded_evaluation" });
  expect(assessMove({ ...input, after: engine("BLACK", 100, "cp", "exact", 7) })).toHaveProperty("reason", "shallow_search");
});
it("does not penalize a board-proven forced move", () => {
  const fen = "8/8/8/8/8/2k5/r6r/K7 w - - 0 1";
  expect(assessMove({ fenBefore: fen, move: "a1b1", before: engine("WHITE", 0), after: engine("BLACK", 500) })).toMatchObject({ quality: "normal", reason: "forced", cpLoss: null, facts: { legalMoveCount: 1 } });
});
it("handles checkmate and mate zero without losing winner identity", () => {
  const board = new Chess(); for (const move of ["f3", "e5", "g4"]) board.move(move);
  const result = assessMove({ fenBefore: board.fen(), move: "d8h4", before: engine("BLACK", 1, "mate"), after: engine("WHITE", 0, "mate", "exact", 0) });
  expect(result).toMatchObject({ quality: "normal", reason: "checkmate", cpLoss: null, facts: { terminal: "checkmate", after: { score: { kind: "mate", value: 0, winner: "BLACK" } } } });
});
it("uses a proven terminal draw even when engine evaluation is missing", () => {
  const result = assessMove({ fenBefore: "7k/8/5QK1/8/8/8/8/8 w - - 0 1", move: "f6f7", before: engine("WHITE", 2, "mate"), after: { perspective: "BLACK", bestMove: null, evaluation: null } });
  expect(result).toMatchObject({ quality: "blunder", reason: "mate_missed", cpLoss: null, facts: { terminal: "draw" } });
});
it("does not call a matching best move brilliant or blindly trust contradictory searches", () => {
  const input = { fenBefore: initial, move: "e2e4", before: { ...engine("WHITE", 30), bestMove: "e2e4" }, after: engine("BLACK", -25) };
  expect(assessMove(input)).toHaveProperty("quality", "normal");
  expect(assessMove({ ...input, after: engine("BLACK", 100) })).toMatchObject({ quality: "unknown", reason: "search_disagreement" });
});
it("rejects wrong perspective, illegal moves, and nonterminal mate zero", () => {
  expect(() => normalizeEvaluation(engine("BLACK", 10), initial)).toThrow(/perspective/);
  expect(() => normalizeEvaluation(engine("WHITE", 0, "mate"), initial)).toThrow(/Mate zero/);
  expect(() => assessMove({ fenBefore: initial, move: "e2e5", before: engine("WHITE", 0), after: engine("BLACK", 0) })).toThrow(/legal/);
});
it("preserves White as the mate-zero winner through JSON serialization", () => {
  const fen = "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1";
  const normalized = normalizeEvaluation(engine("BLACK", 0, "mate", "exact", 0), fen);
  expect(JSON.parse(JSON.stringify(normalized))).toMatchObject({ score: { kind: "mate", value: 0, winner: "WHITE" } });
});
it("preserves equivalent alternatives and handles the depth-eight boundary", () => {
  const input = { fenBefore: initial, move: "e2e4", before: { ...engine("WHITE", 20, "cp", "exact", 8), bestMove: "d2d4" }, after: engine("BLACK", -1, "cp", "exact", 8) };
  expect(assessMove(input)).toMatchObject({ quality: "normal", cpLoss: 19 });
  expect(assessMove({ ...input, before: { ...input.before, evaluation: null } })).toHaveProperty("reason", "missing_evaluation");
  expect(assessMove({ ...input, after: engine("BLACK", -1, "cp", "upper") })).toHaveProperty("reason", "bounded_evaluation");
});
