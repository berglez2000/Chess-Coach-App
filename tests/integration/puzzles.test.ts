import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createImportRepository } from "@/lib/games/import-repository";
import { parsePgn } from "@/lib/pgn/parse";
import { generatePuzzles } from "@/lib/puzzles/generate";
import { createPuzzleRepository, puzzleSummary } from "@/lib/puzzles/repository";
import { PUZZLE_POLICY, type ValidatedPuzzle } from "@/lib/puzzles/policy";
import type { EngineResult } from "@/types/engine";
import { createTestOwner } from "../support/test-owner";
import { assertTestDatabase, createTestDb } from "../support/database";

const db = createTestDb();
const owners: string[] = [];
const ids: string[] = [];
const fen = "4k3/8/8/8/8/8/3q4/3QK3 w - - 0 1";
const first = { depth: 14, score: { kind: "cp" as const, value: 500, bound: "exact" as const }, pv: ["d1d2"] };
const result: EngineResult = { perspective: "WHITE", bestMove: "d1d2", evaluation: first,
  variations: [first, { ...first, score: { ...first.score, value: 0 }, pv: ["e1d2"] }] };
const engine = () => ({ analyze: vi.fn(async () => result) });
async function saved() {
  const parsed = parsePgn(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. Kf1 *`);
  const { id } = await createImportRepository(db, owners[0]).create(parsed, "WHITE");
  ids.push(id);
  const move = await db.gameMove.findFirstOrThrow({ where: { gameId: id } });
  await db.moveEngineAnalysis.create({ data: { moveId: move.id, runId: "source-run", bestMoveUci: "d1d2", pvUci: ["d1d2"], pvSan: ["Qxd2"], cpLoss: 400, classification: "blunder", assessment: {}, configuration: {} } });
  await db.game.update({ where: { id }, data: { analysisStatus: "ENGINE_COMPLETED" } });
  return id;
}
beforeAll(async () => { await assertTestDatabase(db); owners.push(await createTestOwner(db), await createTestOwner(db)); });
afterEach(async () => { await assertTestDatabase(db); await db.game.deleteMany({ where: { id: { in: ids } } }); ids.length = 0; });
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });

it("persists a versioned puzzle, preserves the review, and deduplicates repeated generation", async () => {
  const id = await saved();
  const before = await db.game.findUnique({ where: { id }, include: { moves: { include: { engineAnalysis: true } } } });
  const factory = vi.fn(engine);
  expect(await generatePuzzles(id, createPuzzleRepository(db, owners[0]), factory)).toHaveProperty("status", "COMPLETED");
  expect(await generatePuzzles(id, createPuzzleRepository(db, owners[0]), factory)).toHaveProperty("status", "COMPLETED");
  expect(factory).toHaveBeenCalledOnce();
  const generation = await db.puzzleGeneration.findUniqueOrThrow({ where: { gameId_version: { gameId: id, version: 1 } }, include: { puzzles: true } });
  expect(generation.configuration).toEqual(PUZZLE_POLICY);
  expect(generation.puzzles).toHaveLength(1);
  expect(generation.puzzles[0]).toMatchObject({ sourcePly: 1, startingFen: fen, sourceRunId: "source-run", playerColor: "WHITE", acceptedMoves: ["d1d2"], validation: result });
  expect(await db.game.findUnique({ where: { id }, include: { moves: { include: { engineAnalysis: true } } } })).toEqual(before);
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "COMPLETED", count: 1 });
  expect(await puzzleSummary(db, id, owners[0])).not.toHaveProperty("acceptedMoves");
});
it("isolates reads, claims, failure updates and publication between two users", async () => {
  const id = await saved(); const other = createPuzzleRepository(db, owners[1]);
  expect(await other.load(id)).toBeNull();
  await expect(other.claim(id)).rejects.toThrow();
  expect(await generatePuzzles(id, other, engine)).toHaveProperty("status", "NOT_FOUND");
  const own = createPuzzleRepository(db, owners[0]);
  expect(await own.claim(id)).toBe("CLAIMED");
  await other.fail(id);
  await expect(other.complete(id, [], 0)).rejects.toThrow(/ownership/);
  expect(await puzzleSummary(db, id, owners[1])).toBeNull();
  expect(await puzzleSummary(db, id, owners[0])).toHaveProperty("status", "RUNNING");
});
it("recovers failed generation without partial writes", async () => {
  const id = await saved();
  expect(await generatePuzzles(id, createPuzzleRepository(db, owners[0]), () => ({ analyze: async () => { throw new Error("private path"); } }))).toHaveProperty("status", "FAILED");
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "FAILED", count: 0, error: expect.not.stringContaining("private path") });
  expect(await generatePuzzles(id, createPuzzleRepository(db, owners[0]), engine)).toHaveProperty("status", "COMPLETED");
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "COMPLETED", count: 1, error: null });
});
it("allows one concurrent claimant and fences publication by an expired worker", async () => {
  const id = await saved();
  const old = createPuzzleRepository(db, owners[0]);
  expect(await old.claim(id)).toBe("CLAIMED");
  expect(await createPuzzleRepository(db, owners[0]).claim(id)).toBe("BUSY");
  await db.puzzleGeneration.updateMany({ where: { gameId: id }, data: { leaseUntil: new Date(0) } });
  expect(await generatePuzzles(id, createPuzzleRepository(db, owners[0]), engine)).toHaveProperty("status", "COMPLETED");
  await expect(old.complete(id, [], 0)).rejects.toThrow(/ownership/);
  await old.fail(id);
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "COMPLETED", count: 1 });
});
it("rolls back the completion status if saving puzzles fails", async () => {
  const id = await saved(); const repo = createPuzzleRepository(db, owners[0]);
  await repo.claim(id);
  const puzzle: ValidatedPuzzle = { sourcePly: 1, sourceRunId: "source-run", startingFen: fen, playerColor: "WHITE", acceptedMoves: ["d1d2"], validation: result };
  await expect(repo.complete(id, [puzzle, puzzle], 1)).rejects.toThrow();
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "RUNNING", count: 0 });
});
it("persists an empty result and does not regenerate it on repeat requests", async () => {
  const id = await saved();
  const ambiguous = { ...result, variations: [first, { ...first, pv: ["e1d2"] }] };
  const factory = vi.fn(() => ({ analyze: async () => ambiguous }));
  await generatePuzzles(id, createPuzzleRepository(db, owners[0]), factory);
  await generatePuzzles(id, createPuzzleRepository(db, owners[0]), factory);
  expect(factory).toHaveBeenCalledOnce();
  expect(await puzzleSummary(db, id, owners[0])).toMatchObject({ status: "COMPLETED", count: 0, checkedCandidates: 1 });
});
