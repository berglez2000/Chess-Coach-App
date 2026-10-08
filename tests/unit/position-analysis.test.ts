import { Chess, DEFAULT_POSITION } from "chess.js";
import { expect, it } from "vitest";
import { positionResult, readAnalysisRequest, scoreLabel, terminalResult, validatePosition } from "@/lib/position-analysis/contract";
import { acquireAnalysis } from "@/lib/position-analysis/capacity";
const info = (value: number, pv: string[], kind: "cp" | "mate" = "cp") => ({ depth: 15, score: { kind, value, bound: "exact" as const }, pv });
it("normalizes Black scores/bounds without reversing engine ranking and converts legal SAN continuations", () => {
  const board = new Chess(); board.move("e4");
  const result = positionResult(board.fen(), { perspective: "BLACK", bestMove: "e7e5", evaluation: null,
    variations: [info(32, ["e7e5", "g1f3"]), info(28, ["c7c5"]), { ...info(14, ["e7e6"]), score: { kind: "cp", value: 14, bound: "lower" } }] });
  expect(result.candidates.map(candidate => scoreLabel(candidate.evaluation))).toEqual(["-0.32", "-0.28", "≤-0.14"]);
  expect(result.candidates[0].moves.map(move => move.label)).toEqual(["1… e5", "2. Nf3"]);
});
it("keeps mate scores separate from pawn scores and rejects illegal/duplicate continuations", () => {
  const fen = "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1";
  const result = positionResult(fen, { perspective: "WHITE", bestMove: "f7g7", evaluation: info(1, ["f7g7"], "mate") });
  expect(scoreLabel(result.evaluation!)).toBe("+M1");
  expect(result.candidates[0].moves[0].san).toBe("Qg7#");
  expect(() => positionResult(DEFAULT_POSITION, { perspective: "WHITE", bestMove: "e2e5", evaluation: info(1, ["e2e5"]) })).toThrow();
  expect(() => positionResult(DEFAULT_POSITION, { perspective: "WHITE", bestMove: "e2e4", evaluation: null, variations: [info(10, ["e2e4"]), info(9, ["e2e4"])] })).toThrow();
});
it.each([
  ["7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", "checkmate", "+M0"],
  ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "stalemate", "0.00"],
  ["7k/8/6K1/8/8/8/8/8 w - - 0 1", "draw", "0.00"],
])("derives terminal evaluation without an engine (%s)", (fen, terminal, label) => {
  const result = terminalResult(validatePosition(fen));
  expect(result?.terminal).toBe(terminal); expect(result?.candidates).toEqual([]); expect(scoreLabel(result!.evaluation!)).toBe(label);
});
it("validates supplied positions, move history, presets and unknown fields", () => {
  expect(() => validatePosition("7k/8/6K1/8/8/8/8/7R w - - 0 1")).toThrow(/non-moving king/);
  expect(() => validatePosition("7k/8/6K1/8/8/8/8/8 w K - 0 1")).toThrow(/Castling/);
  expect(() => readAnalysisRequest({ startFen: DEFAULT_POSITION, moves: ["e2e5"], preset: "deep" })).toThrow();
  expect(() => readAnalysisRequest({ startFen: DEFAULT_POSITION, preset: "infinite" })).toThrow();
  expect(() => readAnalysisRequest({ startFen: DEFAULT_POSITION, preset: "quick", ownerId: "foreign" })).toThrow();
  const moves = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
  expect(terminalResult(readAnalysisRequest({ startFen: DEFAULT_POSITION, moves, preset: "quick" }).board)?.terminal).toBe("draw");
});
it("bounds simultaneous searches per owner/server and releases slots", () => {
  const releaseA = acquireAnalysis("a")!; expect(acquireAnalysis("a")).toBeNull();
  const releaseB = acquireAnalysis("b")!; expect(acquireAnalysis("c")).toBeNull();
  releaseA(); const releaseC = acquireAnalysis("c")!; expect(releaseC).toBeTypeOf("function"); releaseB(); releaseC();
});
it("can analyze an imported game that continued after an unclaimed repetition", () => {
  const moves = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8", "e2e4"];
  const input = readAnalysisRequest({ startFen: DEFAULT_POSITION, moves, preset: "quick" });
  expect(input.board.turn()).toBe("b"); expect(terminalResult(input.board)).toBeNull();
});
