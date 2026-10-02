import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { Chess } from "chess.js";
import { applyPuzzleAction, INITIAL_PROGRESS, puzzleActionSchema, solverDto, type PuzzleDefinition } from "@/lib/puzzles/solve";
import type { PuzzleAction } from "@/types/puzzle";

const puzzle: PuzzleDefinition = { id: "puzzle", startingFen: new Chess().fen(), playerColor: "WHITE", sourcePly: 1, acceptedMoves: ["e2e4", "d2d4"], generation: { gameId: "game" } };
const move = (uci: string): PuzzleAction => ({ requestId: randomUUID(), expectedRevision: 0, action: "MOVE", move: uci });
const action = (kind: "HINT" | "REVEAL" | "RETRY"): PuzzleAction => ({ requestId: randomUUID(), expectedRevision: 0, action: kind });
it("withholds answers and engine evidence until solved or revealed", () => {
  const dto = solverDto(puzzle, INITIAL_PROGRESS);
  expect(dto.solution).toBeNull(); expect(dto.hintSquare).toBeNull();
  expect(JSON.stringify(dto)).not.toContain("e2e4");
  expect(dto).not.toHaveProperty("acceptedMoves");
  expect(dto).not.toHaveProperty("generation");
});
it("distinguishes illegal moves, incorrect legal moves, correct answers and accepted alternatives", () => {
  expect(applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("e2e5"))).toMatchObject({ lastOutcome: "ILLEGAL", state: "SOLVING", moveAttempts: 1, completedAt: null });
  expect(applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("e2e4q")).lastOutcome).toBe("ILLEGAL");
  expect(applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("g1f3"))).toMatchObject({ lastOutcome: "INCORRECT", state: "SOLVING" });
  expect(applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("e2e4"))).toMatchObject({ lastOutcome: "CORRECT", state: "SOLVED", completionAssisted: false });
  const alternative = applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("d2d4"));
  expect(alternative).toMatchObject({ lastOutcome: "ACCEPTED_ALTERNATIVE", state: "SOLVED" });
  expect(solverDto(puzzle, alternative).solution).toMatchObject({ uci: "d2d4", san: "d4" });
});
it("saves hints before exposing them and keeps assistance across retry", () => {
  const hinted = applyPuzzleAction(puzzle, INITIAL_PROGRESS, action("HINT"));
  expect(solverDto(puzzle, hinted)).toMatchObject({ hintSquare: "e2", solution: null });
  const retry = applyPuzzleAction(puzzle, hinted, action("RETRY"));
  expect(retry).toMatchObject({ assisted: true, hintUsed: false, completedAt: null });
  expect(applyPuzzleAction(puzzle, retry, move("e2e4"))).toMatchObject({ completionAssisted: true });
});
it("revealing is not a completion, but solving after reveal is assisted", () => {
  const revealed = applyPuzzleAction(puzzle, INITIAL_PROGRESS, action("REVEAL"));
  expect(revealed).toMatchObject({ state: "REVEALED", completedAt: null, assisted: true });
  expect(solverDto(puzzle, revealed).solution).toMatchObject({ uci: "e2e4" });
  const retry = applyPuzzleAction(puzzle, revealed, action("RETRY"));
  expect(solverDto(puzzle, retry).solution).toBeNull();
  expect(applyPuzzleAction(puzzle, retry, move("e2e4"))).toMatchObject({ completionAssisted: true });
});
it("preserves the first completion when practicing again", () => {
  const solved = applyPuzzleAction(puzzle, INITIAL_PROGRESS, move("e2e4"), new Date("2026-10-01T00:00:00Z"));
  const retry = applyPuzzleAction(puzzle, solved, action("RETRY"));
  expect(retry.assisted).toBe(true);
  const again = applyPuzzleAction(puzzle, retry, move("d2d4"));
  expect(again.completedAt).toBe(solved.completedAt);
  expect(again.completionAssisted).toBe(false);
  expect(applyPuzzleAction(puzzle, solved, move("e2e4")).moveAttempts).toBe(1);
});
it("reopens a legacy completion without sequence history and keeps its accepted alternative", () => {
  const legacy = { ...INITIAL_PROGRESS, state: "SOLVED" as const, solvedMove: "d2d4", completedAt: "2026-10-01T00:00:00Z", completionAssisted: false };
  expect(solverDto(puzzle, legacy)).toMatchObject({ history: [{ uci: "d2d4", san: "d4" }], solution: { uci: "d2d4" },
    progress: { completedAt: legacy.completedAt, completionAssisted: false } });
  expect(applyPuzzleAction(puzzle, legacy, action("RETRY"))).toMatchObject({ playedMoves: [], assisted: true, completedAt: legacy.completedAt });
});
it("handles Black's turn, underpromotion and castling legally", () => {
  const blackBoard = new Chess(); blackBoard.move("e4");
  const black = { ...puzzle, startingFen: blackBoard.fen(), playerColor: "BLACK" as const, acceptedMoves: ["e7e5"] };
  expect(applyPuzzleAction(black, INITIAL_PROGRESS, move("e7e5")).state).toBe("SOLVED");
  const promotion = { ...puzzle, startingFen: "7k/P7/8/8/8/8/8/7K w - - 0 1", acceptedMoves: ["a7a8n"] };
  expect(applyPuzzleAction(promotion, INITIAL_PROGRESS, move("a7a8q")).lastOutcome).toBe("INCORRECT");
  expect(solverDto(promotion, applyPuzzleAction(promotion, INITIAL_PROGRESS, move("a7a8n"))).solution?.san).toBe("a8=N");
  const castle = { ...puzzle, startingFen: "4k3/8/8/8/8/8/8/4K2R w K - 0 1", acceptedMoves: ["e1g1"] };
  expect(applyPuzzleAction(castle, INITIAL_PROGRESS, move("e1g1")).state).toBe("SOLVED");
});
it("validates request identity/revision and rejects client-supplied correctness or assistance", () => {
  expect(puzzleActionSchema.safeParse(move("e2e4")).success).toBe(true);
  expect(puzzleActionSchema.safeParse({ ...move("e2e4"), correct: true }).success).toBe(false);
  expect(puzzleActionSchema.safeParse({ ...action("RETRY"), assisted: false }).success).toBe(false);
  expect(puzzleActionSchema.safeParse({ ...move("e2e4"), expectedRevision: -1 }).success).toBe(false);
  expect(puzzleActionSchema.safeParse({ ...move("e2e4"), requestId: "bad" }).success).toBe(false);
});
