import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { createImportRepository } from "@/lib/games/import-repository";
import { parsePgn } from "@/lib/pgn/parse";
import { actOnPuzzle, findPracticePuzzle, listPracticePuzzles, nextPracticePuzzle } from "@/lib/puzzles/practice-repository";
import type { PuzzleAction } from "@/types/puzzle";
import { assertTestDatabase, createTestDb } from "../support/database";
import { createTestOwner } from "../support/test-owner";

const db = createTestDb(); const owners: string[] = []; const games: string[] = [];
beforeAll(async () => { await assertTestDatabase(db); owners.push(await createTestOwner(db), await createTestOwner(db)); });
afterEach(async () => { await assertTestDatabase(db); await db.game.deleteMany({ where: { id: { in: games } } }); games.length = 0; });
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });
async function seeded(owner = owners[0], sequence = false) {
  const parsed = parsePgn("1. Nf3 e5 2. d4 *");
  const game = await createImportRepository(db, owner).create(parsed, "WHITE"); games.push(game.id);
  const generation = await db.puzzleGeneration.create({ data: { gameId: game.id, version: 1, status: "COMPLETED", configuration: {}, puzzles: {
    create: [1, 3].map(ply => ({ sourcePly: ply, sourceRunId: "fixture", startingFen: parsed.moves[ply - 1].fenBefore, playerColor: "WHITE", acceptedMoves: ply === 1 ? ["e2e4", "d2d4"] : ["f3e5"], validation: {},
      ...(sequence && ply === 1 ? { solution: { version: 1, maxPlayerMoves: 3, lines: [
        { moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"], goal: "validated-boundary" },
        { moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3"], goal: "validated-boundary" },
      ] } } : {}),
    })),
  } }, include: { puzzles: { orderBy: { sourcePly: "asc" } } } });
  return { id: generation.puzzles[0].id, nextId: generation.puzzles[1].id, gameId: game.id };
}
function input(action: "HINT" | "REVEAL" | "RETRY", expectedRevision: number): PuzzleAction;
function input(action: "MOVE", expectedRevision: number, move: string): PuzzleAction;
function input(action: "HINT" | "REVEAL" | "RETRY" | "MOVE", expectedRevision: number, move?: string): PuzzleAction {
  const base = { requestId: randomUUID(), expectedRevision };
  return action === "MOVE" ? { ...base, action, move: move! } : { ...base, action };
}
it("conceals answers, persists wrong/correct attempts and reloads the solved board", async () => {
  const { id } = await seeded();
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ solution: null, progress: { revision: 0, moveAttempts: 0 } });
  const definition = await db.personalPuzzle.findUnique({ where: { id } });
  expect(await actOnPuzzle(db, id, owners[0], input("MOVE", 0, "e2e5"))).toMatchObject({ status: "OK", puzzle: { solution: null, progress: { lastOutcome: "ILLEGAL" } } });
  expect(await actOnPuzzle(db, id, owners[0], input("MOVE", 1, "g1f3"))).toMatchObject({ puzzle: { progress: { lastOutcome: "INCORRECT" } } });
  expect(await actOnPuzzle(db, id, owners[0], input("MOVE", 2, "d2d4"))).toMatchObject({ puzzle: { solution: { uci: "d2d4" }, progress: { lastOutcome: "ACCEPTED_ALTERNATIVE", completionAssisted: false } } });
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ solution: { uci: "d2d4" }, progress: { state: "SOLVED", moveAttempts: 3 } });
  expect(await db.personalPuzzle.findUnique({ where: { id } })).toEqual(definition);
  expect(await db.puzzleAttempt.count({ where: { progress: { puzzleId: id } } })).toBe(3);
});
it("keeps help after refresh and retry, records assisted completion only once", async () => {
  const { id } = await seeded();
  await actOnPuzzle(db, id, owners[0], input("HINT", 0));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ hintSquare: "e2", solution: null, progress: { assisted: true } });
  await actOnPuzzle(db, id, owners[0], input("REVEAL", 1));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ solution: { uci: "e2e4" }, progress: { completedAt: null } });
  await actOnPuzzle(db, id, owners[0], input("RETRY", 2));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ solution: null, progress: { assisted: true } });
  await actOnPuzzle(db, id, owners[0], input("MOVE", 3, "e2e4"));
  const first = (await findPracticePuzzle(db, id, owners[0]))!.progress.completedAt;
  await actOnPuzzle(db, id, owners[0], input("RETRY", 4));
  await actOnPuzzle(db, id, owners[0], input("MOVE", 5, "d2d4"));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ progress: { completedAt: first, completionAssisted: true } });
  expect(await db.puzzleProgress.count({ where: { puzzleId: id, completedAt: { not: null } } })).toBe(1);
});
it("deduplicates concurrent delivery of the same action and rejects reused keys with a different move", async () => {
  const { id } = await seeded(); const action = input("MOVE", 0, "e2e4");
  const results = await Promise.all([actOnPuzzle(db, id, owners[0], action), actOnPuzzle(db, id, owners[0], action)]);
  expect(results.map(result => result.status)).toEqual(["OK", "OK"]);
  expect(await actOnPuzzle(db, id, owners[0], action)).toHaveProperty("status", "OK");
  expect(await db.puzzleAttempt.count({ where: { progress: { puzzleId: id } } })).toBe(1);
  expect(await actOnPuzzle(db, id, owners[0], { ...action, action: "MOVE", move: "d2d4" })).toHaveProperty("status", "CONFLICT");
});
it("rejects stale-tab writes without losing assistance or inflating attempts", async () => {
  const { id } = await seeded();
  await actOnPuzzle(db, id, owners[0], input("HINT", 0));
  expect(await actOnPuzzle(db, id, owners[0], input("MOVE", 0, "e2e4"))).toMatchObject({ status: "CONFLICT", puzzle: { solution: null, progress: { revision: 1, assisted: true } } });
  expect(await db.puzzleAttempt.count({ where: { progress: { puzzleId: id } } })).toBe(1);
  expect(await actOnPuzzle(db, id, owners[0], input("MOVE", 1, "e2e4"))).toMatchObject({ puzzle: { progress: { completionAssisted: true } } });
});
it("serializes competing actions from two tabs", async () => {
  const { id } = await seeded();
  const results = await Promise.all([actOnPuzzle(db, id, owners[0], input("HINT", 0)), actOnPuzzle(db, id, owners[0], input("MOVE", 0, "e2e4"))]);
  expect(results.map(result => result.status).sort()).toEqual(["CONFLICT", "OK"]);
  expect(await db.puzzleAttempt.count({ where: { progress: { puzzleId: id } } })).toBe(1);
  expect((await findPracticePuzzle(db, id, owners[0]))!.progress.revision).toBe(1);
});
it("isolates definitions, progress, lists and navigation from another user", async () => {
  const { id, nextId, gameId } = await seeded();
  const other = await seeded(owners[1]);
  for (const action of [input("MOVE", 0, "e2e4"), input("HINT", 0), input("REVEAL", 0), input("RETRY", 0)]) {
    expect(await actOnPuzzle(db, id, owners[1], action)).toHaveProperty("status", "NOT_FOUND");
  }
  expect(await findPracticePuzzle(db, id, owners[1])).toBeNull();
  expect(await nextPracticePuzzle(db, id, owners[1])).toBeNull();
  expect(await listPracticePuzzles(db, owners[1], gameId)).toMatchObject({ count: 0, rows: [] });
  expect((await listPracticePuzzles(db, owners[1])).rows.map(row => row.id).sort()).toEqual([other.id, other.nextId].sort());
  expect(await nextPracticePuzzle(db, id, owners[0])).toBe(nextId);
  expect(await nextPracticePuzzle(db, nextId, owners[0])).toBeNull();
  expect(await db.puzzleProgress.count({ where: { puzzleId: id } })).toBe(0);
});
it("persists intermediate positions and branch replies, deduplicates delivery, and completes only after the final move", async () => {
  const { id } = await seeded(owners[0], true);
  const before = await db.personalPuzzle.findUniqueOrThrow({ where: { id } });
  const move = input("MOVE", 0, "d2d4");
  const results = await Promise.all([actOnPuzzle(db, id, owners[0], move), actOnPuzzle(db, id, owners[0], move)]);
  expect(results.map(result => result.status)).toEqual(["OK", "OK"]);
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ solutionLine: null, history: [{ uci: "d2d4" }, { uci: "d7d5" }],
    progress: { state: "SOLVING", completedAt: null, revision: 1, moveAttempts: 1 } });
  expect(await actOnPuzzle(db, id, owners[1], input("MOVE", 1, "c2c4"))).toHaveProperty("status", "NOT_FOUND");
  await actOnPuzzle(db, id, owners[0], input("HINT", 1));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ hintSquare: "c2", progress: { assisted: true } });
  await actOnPuzzle(db, id, owners[0], input("MOVE", 2, "c2c4"));
  expect(await findPracticePuzzle(db, id, owners[0])).toMatchObject({ hintSquare: null, progress: { playedMoves: ["d2d4", "d7d5", "c2c4", "e7e6"], completedAt: null } });
  await actOnPuzzle(db, id, owners[0], input("MOVE", 3, "b1c3"));
  const completed = (await findPracticePuzzle(db, id, owners[0]))!;
  expect(completed.progress).toMatchObject({ state: "SOLVED", completionAssisted: true, moveAttempts: 3 });
  expect(completed.solutionLine).toHaveLength(5);
  await actOnPuzzle(db, id, owners[0], input("RETRY", 4));
  for (const [index, uci] of ["e2e4", "g1f3", "f1b5"].entries()) await actOnPuzzle(db, id, owners[0], input("MOVE", 5 + index, uci));
  expect((await findPracticePuzzle(db, id, owners[0]))!.progress.completedAt).toBe(completed.progress.completedAt);
  expect(await db.personalPuzzle.findUniqueOrThrow({ where: { id } })).toEqual(before);
});
it("fences delayed sequence actions after restart and returns current state for a lost-response replay", async () => {
  const { id } = await seeded(owners[0], true);
  const original = input("MOVE", 0, "e2e4");
  await actOnPuzzle(db, id, owners[0], original);
  const late = input("MOVE", 1, "g1f3");
  await actOnPuzzle(db, id, owners[0], input("RETRY", 1));
  expect(await actOnPuzzle(db, id, owners[0], late)).toMatchObject({ status: "CONFLICT", puzzle: { history: [], progress: { revision: 2 } } });
  expect(await actOnPuzzle(db, id, owners[0], original)).toMatchObject({ status: "OK", puzzle: { history: [], progress: { revision: 2 } } });
  expect(await db.puzzleAttempt.count({ where: { progress: { puzzleId: id } } })).toBe(2);
  expect((await db.puzzleProgress.findFirstOrThrow({ where: { puzzleId: id } })).playedMoves).toEqual([]);
});
