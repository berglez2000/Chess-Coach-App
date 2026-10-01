import { Chess } from "chess.js";
import { describe, expect, it, vi } from "vitest";
import { PUZZLE_POLICY, selectCandidates, validatePuzzle, type Candidate } from "@/lib/puzzles/policy";
import { generatePuzzles, type PuzzleRepository } from "@/lib/puzzles/generate";
import type { EngineResult } from "@/types/engine";

const fen = "4k3/8/8/8/8/8/3q4/3QK3 w - - 0 1";
const candidate: Candidate = { ply: 1, color: "WHITE", fenBefore: fen, uci: "e1f1",
  engineAnalysis: { runId: "run", cpLoss: 400, classification: "blunder", bestMoveUci: "d1d2" } };
function result(best = 500, runner = 0): EngineResult {
  const lines = [
    { depth: 14, score: { kind: "cp" as const, value: best, bound: "exact" as const }, pv: ["d1d2"] },
    { depth: 14, score: { kind: "cp" as const, value: runner, bound: "exact" as const }, pv: ["e1d2"] },
  ];
  return { perspective: "WHITE", bestMove: "d1d2", evaluation: lines[0], variations: lines };
}
function repository(overrides: Partial<PuzzleRepository> = {}): PuzzleRepository {
  return { load: vi.fn(async () => ({ userColor: "WHITE" as const, analysisStatus: "ENGINE_COMPLETED", moves: [candidate] })),
    claim: vi.fn(async () => "CLAIMED" as const), complete: vi.fn(async () => {}), fail: vi.fn(async () => {}), ...overrides };
}
it("selects only the player's substantial mistakes in stable loss order, with a bounded budget", () => {
  const moves = Array.from({ length: 9 }, (_, index) => ({ ...candidate, ply: index + 1 }));
  expect(selectCandidates(moves, "WHITE").map(move => move.ply)).toEqual([1, 2, 3, 4, 5]);
  expect(selectCandidates(moves, "BLACK")).toEqual([]);
  expect(selectCandidates([{ ...candidate, engineAnalysis: null }], "WHITE")).toEqual([]);
  expect(selectCandidates([{ ...candidate, engineAnalysis: { ...candidate.engineAnalysis!, cpLoss: 99 } }], "WHITE")).toEqual([]);
});
it("persists a legal unique winning move from before the user's mistake", () => {
  const puzzle = validatePuzzle(candidate, result());
  expect(puzzle).toMatchObject({ sourcePly: 1, sourceRunId: "run", startingFen: fen, playerColor: "WHITE", acceptedMoves: ["d1d2"] });
  const board = new Chess(puzzle!.startingFen);
  expect(board.move({ from: "d1", to: "d2" }).captured).toBe("q");
});
it("uses the mover's perspective for Black puzzles", () => {
  const black = { ...candidate, color: "BLACK" as const, fenBefore: "3qk3/3Q4/8/8/8/8/8/4K3 b - - 0 1", uci: "e8f8", engineAnalysis: { ...candidate.engineAnalysis!, bestMoveUci: "d8d7" } };
  const assessment = result();
  assessment.perspective = "BLACK"; assessment.bestMove = "d8d7";
  assessment.variations![0].pv = ["d8d7"]; assessment.variations![1].pv = ["e8d7"];
  expect(validatePuzzle(black, assessment)).toMatchObject({ playerColor: "BLACK", acceptedMoves: ["d8d7"] });
});
it.each([[199, 0], [500, 400], [500, 500], [-100, -500]])("skips weak or ambiguous candidates (%s, %s)", (best, runner) => {
  expect(validatePuzzle(candidate, result(best, runner))).toBeNull();
});
it("accepts a unique forced mate but rejects multiple mating alternatives", () => {
  const assessment = result();
  assessment.variations![0].score = { kind: "mate", value: 3, bound: "exact" };
  expect(validatePuzzle(candidate, assessment)).not.toBeNull();
  assessment.variations![1].score = { kind: "mate", value: 4, bound: "exact" };
  expect(validatePuzzle(candidate, assessment)).toBeNull();
});
it("rejects incomplete depth, bounded scores, duplicate roots, changed best moves and mismatched perspectives", () => {
  const shallow = result(); shallow.variations![1].depth = 13;
  expect(validatePuzzle(candidate, shallow)).toBeNull();
  const bounded = result(); bounded.variations![1].score.bound = "lower";
  expect(validatePuzzle(candidate, bounded)).toBeNull();
  const duplicate = result(); duplicate.variations![1].pv = ["d1d2"];
  expect(validatePuzzle(candidate, duplicate)).toBeNull();
  expect(validatePuzzle({ ...candidate, uci: "d1d2" }, result())).toBeNull();
  expect(validatePuzzle(candidate, { ...result(), variations: undefined })).toBeNull();
  expect(() => validatePuzzle(candidate, { ...result(), perspective: "BLACK" })).toThrow();
});
it("rejects illegal continuations instead of storing an unvalidated answer", () => {
  const assessment = result(); assessment.variations![1].pv.push("e8e5");
  expect(() => validatePuzzle(candidate, assessment)).toThrow();
});
describe("generation", () => {
  it("saves validated puzzles atomically and needs no coaching", async () => {
    const repo = repository();
    expect(await generatePuzzles("game", repo, () => ({ analyze: async () => result() }))).toEqual({ status: "COMPLETED" });
    expect(repo.complete).toHaveBeenCalledWith("game", [expect.objectContaining({ acceptedMoves: ["d1d2"] })], 1);
  });
  it("saves an honest empty result without starting an engine when no mistakes qualify", async () => {
    const repo = repository({ load: async () => ({ userColor: "BLACK", analysisStatus: "ENGINE_COMPLETED", moves: [candidate] }) });
    const factory = vi.fn();
    expect(await generatePuzzles("game", repo, factory)).toHaveProperty("status", "COMPLETED");
    expect(repo.complete).toHaveBeenCalledWith("game", [], 0);
    expect(factory).not.toHaveBeenCalled();
  });
  it.each(["COMPLETED", "BUSY"] as const)("does not rerun an existing %s generation", async status => {
    const repo = repository({ claim: async () => status }); const factory = vi.fn();
    expect(await generatePuzzles("game", repo, factory)).toHaveProperty("status", status);
    expect(factory).not.toHaveBeenCalled(); expect(repo.complete).not.toHaveBeenCalled();
  });
  it("records failures without publishing partial puzzles, and retries successfully", async () => {
    const repo = repository();
    expect(await generatePuzzles("game", repo, () => ({ analyze: async () => { throw new Error("private"); } }))).toEqual({ status: "FAILED" });
    expect(repo.fail).toHaveBeenCalledWith("game"); expect(repo.complete).not.toHaveBeenCalled();
    expect(await generatePuzzles("game", repo, () => ({ analyze: async () => result() }))).toHaveProperty("status", "COMPLETED");
  });
  it("refuses missing games and games without saved analysis", async () => {
    const factory = vi.fn();
    expect(await generatePuzzles("game", repository({ load: async () => null }), factory)).toHaveProperty("status", "NOT_FOUND");
    expect(await generatePuzzles("game", repository({ load: async () => ({ userColor: "WHITE", analysisStatus: "PENDING", moves: [] }) }), factory)).toHaveProperty("status", "NOT_READY");
    expect(factory).not.toHaveBeenCalled();
    expect(PUZZLE_POLICY.version).toBe(1);
  });
});
