import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { expect, it, vi } from "vitest";
import { applyPuzzleAction, INITIAL_PROGRESS, solverDto, type PuzzleDefinition } from "@/lib/puzzles/solve";
import { readSolution, replay } from "@/lib/puzzles/sequence";
import { exactRoot, extendPuzzle, validatePuzzle, type Candidate } from "@/lib/puzzles/policy";
import type { EngineResult } from "@/types/engine";
import type { PuzzleAction, PuzzleSolution } from "@/types/puzzle";

const first = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"];
const second = ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3"];
const definition: PuzzleDefinition = { id: "sequence", startingFen: new Chess().fen(), playerColor: "WHITE", sourcePly: 1,
  acceptedMoves: [first[0], second[0]], generation: { gameId: "game" },
  solution: { version: 1, maxPlayerMoves: 3, lines: [first, second].map(moves => ({ moves, goal: "validated-boundary" })) } };
const action = (kind: "MOVE" | "HINT" | "REVEAL" | "RETRY", move?: string): PuzzleAction => kind === "MOVE" ?
  { action: kind, move: move!, requestId: randomUUID(), expectedRevision: 0 } : { action: kind, requestId: randomUUID(), expectedRevision: 0 };

it("alternates turns, saves automatic replies, conceals future moves, and completes only at the boundary", () => {
  expect(JSON.stringify(solverDto(definition, INITIAL_PROGRESS))).not.toContain("e7e5");
  let state = applyPuzzleAction(definition, INITIAL_PROGRESS, action("MOVE", first[0]));
  expect(state).toMatchObject({ playedMoves: first.slice(0, 2), state: "SOLVING", completedAt: null, lastOutcome: "CONTINUE" });
  let dto = solverDto(definition, state);
  expect(dto.currentFen).toBe(replay(definition.startingFen, first.slice(0, 2)).board.fen());
  expect(dto.history.map(move => move.san)).toEqual(["e4", "e5"]);
  expect(dto.solutionLine).toBeNull();
  expect(JSON.stringify(dto)).not.toContain("g1f3");
  state = applyPuzzleAction(definition, state, action("MOVE", first[2]));
  expect(state.completedAt).toBeNull();
  state = applyPuzzleAction(definition, state, action("MOVE", first[4]));
  expect(state).toMatchObject({ state: "SOLVED", moveAttempts: 3, completionAssisted: false, playedMoves: first });
  dto = solverDto(definition, state);
  expect(dto.solutionLine?.map(move => move.uci)).toEqual(first);
  expect(dto.goal).toBe("validated-boundary");
});
it("uses the alternative's own reply and continuation, including alternatives deeper in a branch", () => {
  let state = applyPuzzleAction(definition, INITIAL_PROGRESS, action("MOVE", second[0]));
  expect(state).toMatchObject({ lastOutcome: "ALTERNATIVE_CONTINUE", playedMoves: second.slice(0, 2) });
  const wrong = applyPuzzleAction(definition, state, action("MOVE", "g1f3"));
  expect(wrong).toMatchObject({ lastOutcome: "INCORRECT", playedMoves: second.slice(0, 2) });
  state = applyPuzzleAction(definition, state, action("MOVE", second[2]));
  state = applyPuzzleAction(definition, state, action("MOVE", second[4]));
  expect(solverDto(definition, state).solutionLine?.map(move => move.uci)).toEqual(second);
  const branched = { ...definition, acceptedMoves: [first[0]], solution: { version: 1, maxPlayerMoves: 3,
    lines: [first, ["e2e4", "e7e5", "f1c4", "g8f6", "d2d3"]].map(moves => ({ moves, goal: "validated-boundary" })) } };
  state = applyPuzzleAction(branched, INITIAL_PROGRESS, action("MOVE", first[0]));
  state = applyPuzzleAction(branched, state, action("MOVE", "f1c4"));
  expect(state.playedMoves).toEqual(["e2e4", "e7e5", "f1c4", "g8f6"]);
});
it("checks illegal and incorrect moves against the current position", () => {
  const state = applyPuzzleAction(definition, INITIAL_PROGRESS, action("MOVE", first[0]));
  expect(applyPuzzleAction(definition, state, action("MOVE", "e2e4"))).toMatchObject({ lastOutcome: "ILLEGAL", playedMoves: state.playedMoves });
  expect(applyPuzzleAction(definition, state, action("MOVE", "b1c3"))).toMatchObject({ lastOutcome: "INCORRECT", playedMoves: state.playedMoves });
});
it("hints the current branch, reveals the complete line, and restarts without completing or losing help", () => {
  let state = applyPuzzleAction(definition, INITIAL_PROGRESS, action("MOVE", second[0]));
  state = applyPuzzleAction(definition, state, action("HINT"));
  expect(solverDto(definition, state)).toMatchObject({ hintSquare: "c2", solutionLine: null });
  state = applyPuzzleAction(definition, state, action("REVEAL"));
  expect(state.completedAt).toBeNull();
  expect(solverDto(definition, state).solutionLine?.map(move => move.uci)).toEqual(second);
  state = applyPuzzleAction(definition, state, action("RETRY"));
  expect(state).toMatchObject({ playedMoves: [], assisted: true, hintUsed: false, state: "SOLVING" });
  expect(solverDto(definition, state).currentFen).toBe(definition.startingFen);
  for (const move of [first[0], first[2], first[4]]) state = applyPuzzleAction(definition, state, action("MOVE", move));
  expect(state.completionAssisted).toBe(true);
  const completion = state.completedAt;
  state = applyPuzzleAction(definition, state, action("RETRY"));
  for (const move of [second[0], second[2], second[4]]) state = applyPuzzleAction(definition, state, action("MOVE", move));
  expect(state.completedAt).toBe(completion);
});
it("supports Black sequences and preserves custom starting state", () => {
  const board = new Chess(); board.move("e4");
  const moves = ["c7c5", "g1f3", "d7d6", "d2d4", "c5d4"];
  const black = { ...definition, startingFen: board.fen(), playerColor: "BLACK" as const, acceptedMoves: [moves[0]],
    solution: { version: 1, maxPlayerMoves: 3, lines: [{ moves, goal: "validated-boundary" }] } };
  let state = { ...INITIAL_PROGRESS };
  for (const move of [moves[0], moves[2], moves[4]]) state = applyPuzzleAction(black, state, action("MOVE", move));
  expect(state.state).toBe("SOLVED");
  state = applyPuzzleAction(black, state, action("RETRY"));
  expect(solverDto(black, state).currentFen).toBe(black.startingFen);
});
it("ends at mate and validates promotion and castling within a sequence", () => {
  const board = new Chess(); for (const move of ["e4", "e5", "Bc4", "Nc6"]) board.move(move);
  const moves = ["d1h5", "g8f6", "h5f7"];
  const mate = { ...definition, startingFen: board.fen(), acceptedMoves: [moves[0]],
    solution: { version: 1, maxPlayerMoves: 3, lines: [{ moves, goal: "mate" }] } };
  let state = applyPuzzleAction(mate, INITIAL_PROGRESS, action("MOVE", moves[0]));
  state = applyPuzzleAction(mate, state, action("MOVE", moves[2]));
  expect(solverDto(mate, state)).toMatchObject({ goal: "mate", solutionLine: [{ san: "Qh5" }, { san: "Nf6" }, { san: "Qxf7#" }] });
  const promotionFen = "7k/P7/8/8/8/7r/8/6K1 w - - 0 1";
  const promotionMoves = ["a7a8n", "h8g7", "a8c7"];
  const promotion = { ...definition, startingFen: promotionFen, acceptedMoves: [promotionMoves[0]],
    solution: { version: 1, maxPlayerMoves: 3, lines: [{ moves: promotionMoves, goal: "validated-boundary" }] } };
  expect(applyPuzzleAction(promotion, INITIAL_PROGRESS, action("MOVE", "a7a8q"))).toMatchObject({ lastOutcome: "INCORRECT", playedMoves: [] });
  state = applyPuzzleAction(promotion, INITIAL_PROGRESS, action("MOVE", "a7a8n"));
  expect(state).toMatchObject({ state: "SOLVING", playedMoves: promotionMoves.slice(0, 2) });
  expect(applyPuzzleAction(promotion, state, action("MOVE", "a8c7")).state).toBe("SOLVED");
  const castleMoves = ["e1g1", "e8d7", "f1f7"];
  expect(readSolution({ version: 1, maxPlayerMoves: 3, lines: [{ moves: castleMoves, goal: "validated-boundary" }] }, "4k3/8/8/8/8/8/8/4K2R w K - 0 1", [castleMoves[0]], "WHITE")).not.toBeNull();
});
it("rejects illegal branches, conflicting replies, false goals, prefixes and excessive length", () => {
  const solution = definition.solution as PuzzleSolution;
  const read = (value: unknown) => readSolution(value, definition.startingFen, definition.acceptedMoves, "WHITE");
  expect(() => read({ ...solution, lines: [{ moves: ["e2e4", "e7e4", "g1f3"], goal: "validated-boundary" }] })).toThrow();
  expect(() => read({ ...solution, lines: [...solution.lines, { moves: ["e2e4", "c7c5", "g1f3"], goal: "validated-boundary" }] })).toThrow(/Conflicting/);
  expect(() => read({ ...solution, lines: [{ moves: first, goal: "mate" }, solution.lines[1]] })).toThrow(/goal/);
  expect(() => read({ ...solution, lines: [...solution.lines, { moves: [first[0]], goal: "validated-boundary" }] })).toThrow(/boundary/);
  expect(() => read({ ...solution, lines: [{ moves: [...first, "a7a6", "b5a4"], goal: "validated-boundary" }] })).toThrow();
  expect(() => read({ ...solution, lines: [{ moves: first.slice(0, 4), goal: "validated-boundary" }] })).toThrow();
});

function assessment(fen: string, best: string, score = 500, runner = 0): EngineResult {
  const board = new Chess(fen);
  const alternative = board.moves({ verbose: true }).map(move => move.from + move.to + (move.promotion ?? "")).find(move => move !== best)!;
  const lines = [{ depth: 14, score: { kind: "cp" as const, value: score, bound: "exact" as const }, pv: [best] },
    ...(alternative ? [{ depth: 14, score: { kind: "cp" as const, value: runner, bound: "exact" as const }, pv: [alternative] }] : []),
  ];
  return { perspective: board.turn() === "w" ? "WHITE" : "BLACK", bestMove: best, evaluation: lines[0], variations: lines };
}
const candidate: Candidate = { ply: 1, color: "WHITE", fenBefore: definition.startingFen, uci: "d2d4",
  engineAnalysis: { runId: "run", cpLoss: 400, classification: "blunder", bestMoveUci: first[0] } };
it("freshly validates every continuation, stores its evidence, and stops after three solver moves", async () => {
  const root = validatePuzzle(candidate, assessment(candidate.fenBefore, first[0]))!;
  const positions = first.slice(1).map((move, index) => ({ fen: replay(candidate.fenBefore, first.slice(0, index + 1)).board.fen(), move }));
  let index = 0;
  const engine = { analyze: vi.fn(async (fen: string) => {
    expect(fen).toBe(positions[index].fen);
    return assessment(fen, positions[index++].move);
  }) };
  const renew = vi.fn(async () => {});
  const puzzle = await extendPuzzle(root, engine, renew);
  expect(puzzle.solution?.lines).toEqual([{ moves: first, goal: "validated-boundary" }]);
  expect(puzzle.validation.continuations).toHaveLength(4);
  expect(engine.analyze).toHaveBeenCalledTimes(4); expect(renew).toHaveBeenCalledTimes(4);
});
it("ends before an ambiguous continuation and does not transplant the previous PV", async () => {
  const root = validatePuzzle(candidate, assessment(candidate.fenBefore, first[0]))!;
  let index = 0;
  const puzzle = await extendPuzzle(root, { analyze: async fen => assessment(fen, first[++index], 500, index === 2 ? 499 : 0) }, async () => {});
  expect(puzzle.solution?.lines[0].moves).toEqual([first[0]]);
  expect(puzzle.validation.continuations).toHaveLength(2);
});
it("fails on illegal engine branches and loss of the generation lease", async () => {
  const root = validatePuzzle(candidate, assessment(candidate.fenBefore, first[0]))!;
  await expect(extendPuzzle(root, { analyze: async fen => assessment(fen, "e7e4") }, async () => {})).rejects.toThrow();
  const analyze = vi.fn();
  await expect(extendPuzzle(root, { analyze }, async () => { throw new Error("ownership lost"); })).rejects.toThrow(/ownership/);
  expect(analyze).not.toHaveBeenCalled();
});
it("generates a smothered mate in two with a forced reply and stops searching at checkmate", async () => {
  const fen = "3r1r1k/ppp3pp/7N/8/8/1Q6/8/6K1 w - - 4 3";
  const moves = ["b3g8", "f8g8", "h6f7"];
  const rootResult = assessment(fen, moves[0]);
  rootResult.variations![0].score = { kind: "mate", value: 2, bound: "exact" };
  const root = validatePuzzle({ ...candidate, fenBefore: fen, uci: "b3c3", engineAnalysis: { ...candidate.engineAnalysis!, bestMoveUci: moves[0] } }, rootResult)!;
  let index = 0;
  const analyze = vi.fn(async (position: string) => {
    const result = assessment(position, moves[++index]);
    result.variations![0].score = { kind: "mate", value: index === 1 ? -1 : 1, bound: "exact" };
    return result;
  });
  const puzzle = await extendPuzzle(root, { analyze }, async () => {});
  expect(puzzle.solution?.lines).toEqual([{ moves, goal: "mate" }]);
  expect(analyze).toHaveBeenCalledTimes(2);
});
it("refuses shallow, bounded or incomplete reply evidence, including illegal promotion suffixes", () => {
  const fen = replay(candidate.fenBefore, [first[0]]).board.fen();
  const incomplete = assessment(fen, first[1]); incomplete.variations!.pop();
  expect(exactRoot(fen, incomplete)).toBeNull();
  const shallow = assessment(fen, first[1]); shallow.variations![0].depth = 13;
  expect(exactRoot(fen, shallow)).toBeNull();
  const bounded = assessment(fen, first[1]); bounded.variations![0].score.bound = "lower";
  expect(exactRoot(fen, bounded)).toBeNull();
  const illegal = assessment(fen, "e7e5q");
  expect(() => exactRoot(fen, illegal)).toThrow(/coordinates/);
});
