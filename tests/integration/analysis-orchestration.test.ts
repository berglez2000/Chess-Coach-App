import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { analyzeGame, type AnalysisConfiguration } from "@/lib/analysis/orchestrate";
import { createAnalysisRepository } from "@/lib/analysis/repository";
import { createImportRepository } from "@/lib/games/import-repository";
import { parsePgn } from "@/lib/pgn/parse";
import type { EngineResult } from "@/types/engine";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
const ids: string[] = [];
const settings: AnalysisConfiguration = { engine: "Stockfish", adapterVersion: 1, depth: 12, moveTimeMs: null, timeoutMs: 30000, threads: 1, hashMb: 16, multiPv: 1 };
const repository = createAnalysisRepository(db);
async function imported(moves = "1. e4 e5 2. Nf3 *") {
  const game = parsePgn(`[Event "orchestration-${randomUUID()}"]\n\n${moves}`);
  const { id } = await createImportRepository(db).create(game, "BLACK");
  ids.push(id);
  return { id, game };
}
function mockEngine() {
  return { analyze: vi.fn(async (fen: string): Promise<EngineResult> => {
    const board = new Chess(fen);
    const legal = board.moves({ verbose: true });
    const best = legal[0];
    const uci = best.from + best.to + (best.promotion ?? "");
    return { perspective: board.turn() === "w" ? "WHITE" : "BLACK", bestMove: uci, evaluation: { depth: 12, score: { kind: "cp", value: 25, bound: "exact" }, pv: [uci] } };
  }) };
}
beforeAll(async () => { await assertTestDatabase(db); });
afterEach(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});
afterAll(async () => { await db.$disconnect(); });
it("stores assessments for the correct plies, White scores, SAN and configuration using N+1 searches", async () => {
  const { id, game } = await imported();
  const engine = mockEngine();
  let runningObserved = false;
  const original = engine.analyze.getMockImplementation()!;
  engine.analyze.mockImplementation(async fen => {
    runningObserved = (await db.game.findUniqueOrThrow({ where: { id } })).analysisStatus === "ENGINE_RUNNING";
    return original(fen);
  });
  expect(await analyzeGame(id, repository, () => ({ engine, configuration: settings }))).toEqual({ status: "ENGINE_COMPLETED", analyzedMoves: 3 });
  expect(runningObserved).toBe(true);
  expect(engine.analyze.mock.calls.map(call => call[0])).toEqual([game.initialFen, ...game.moves.map(move => move.fenAfter)]);
  const stored = await db.game.findUniqueOrThrow({ where: { id }, include: { moves: { orderBy: { ply: "asc" }, include: { engineAnalysis: true } } } });
  expect(stored.analysisStatus).toBe("ENGINE_COMPLETED");
  expect(stored.analysisError).toBeNull();
  for (const [index, move] of stored.moves.entries()) {
    const row = move.engineAnalysis!;
    expect(row).toMatchObject({ moveId: move.id, beforeCp: index % 2 ? -25 : 25, afterCp: index % 2 ? 25 : -25, beforeMate: null, afterMate: null, cpLoss: 50, classification: "mistake", configuration: settings });
    expect(row.assessment).toMatchObject({ policyVersion: 1, facts: { fenBefore: move.fenBefore, fenAfter: move.fenAfter, mover: move.color } });
    const board = new Chess(move.fenBefore);
    expect(row.bestMoveSan).toBe(board.move({ from: row.bestMoveUci!.slice(0, 2), to: row.bestMoveUci!.slice(2, 4), promotion: row.bestMoveUci![4] }).san);
    expect(row.pvSan).toEqual([row.bestMoveSan]);
  }
  expect(new Set(stored.moves.map(move => move.engineAnalysis!.runId)).size).toBe(1);
});
it("preserves committed results on failure and overwrites them safely on retry", async () => {
  const { id } = await imported();
  const engine = mockEngine();
  const original = engine.analyze.getMockImplementation()!;
  let calls = 0;
  engine.analyze.mockImplementation(async fen => { if (++calls === 3) throw new Error("secret engine path"); return original(fen); });
  expect(await analyzeGame(id, repository, () => ({ engine, configuration: settings }))).toHaveProperty("status", "FAILED");
  const failed = await db.game.findUniqueOrThrow({ where: { id } });
  expect(failed.analysisStatus).toBe("FAILED");
  expect(failed.analysisError).not.toContain("secret");
  const saved = await db.moveEngineAnalysis.findMany({ where: { move: { gameId: id } } });
  expect(saved).toHaveLength(1);
  expect(await db.gameMove.count({ where: { gameId: id } })).toBe(3);
  expect(await analyzeGame(id, repository, () => ({ engine: mockEngine(), configuration: settings }))).toHaveProperty("status", "ENGINE_COMPLETED");
  expect(await db.moveEngineAnalysis.count({ where: { move: { gameId: id } } })).toBe(3);
  expect((await db.moveEngineAnalysis.findUniqueOrThrow({ where: { id: saved[0].id } })).runId).not.toBe(saved[0].runId);
});
it("handles checkmate without searching a terminal position", async () => {
  const { id } = await imported("1. f3 e5 2. g4 Qh4# 0-1");
  const engine = mockEngine();
  expect(await analyzeGame(id, repository, () => ({ engine, configuration: settings }))).toHaveProperty("status", "ENGINE_COMPLETED");
  expect(engine.analyze).toHaveBeenCalledTimes(4);
  const last = await db.gameMove.findUniqueOrThrow({ where: { gameId_ply: { gameId: id, ply: 4 } }, include: { engineAnalysis: true } });
  expect(last.engineAnalysis).toMatchObject({ afterCp: null, afterMate: 0, classification: "normal" });
  expect(last.engineAnalysis!.assessment).toMatchObject({ reason: "checkmate", facts: { after: { score: { winner: "BLACK" } } } });
});
it("rejects illegal engine PVs and retains the imported game", async () => {
  const { id } = await imported();
  const engine = mockEngine();
  engine.analyze.mockResolvedValue({ perspective: "WHITE", bestMove: "e2e4", evaluation: { depth: 12, score: { kind: "cp", value: 0, bound: "exact" }, pv: ["e2e5"] } });
  expect(await analyzeGame(id, repository, () => ({ engine, configuration: settings }))).toHaveProperty("status", "FAILED");
  expect(await db.gameMove.count({ where: { gameId: id } })).toBe(3);
  expect(await db.moveEngineAnalysis.count({ where: { move: { gameId: id } } })).toBe(0);
});
it("does not start missing or already-running games", async () => {
  const factory = vi.fn(() => ({ engine: mockEngine(), configuration: settings }));
  expect(await analyzeGame(randomUUID(), repository, factory)).toEqual({ status: "NOT_FOUND" });
  const { id } = await imported();
  await db.game.update({ where: { id }, data: { analysisStatus: "ENGINE_RUNNING", analysisToken: "active-owner", analysisLeaseUntil: new Date(Date.now() + 300000) } });
  expect(await analyzeGame(id, repository, factory)).toEqual({ status: "NOT_READY" });
  expect(factory).not.toHaveBeenCalled();
});
it("records configuration failure after claiming the game", async () => {
  const { id } = await imported();
  await analyzeGame(id, repository, () => { throw new Error("private path"); });
  expect(await db.game.findUniqueOrThrow({ where: { id } })).toMatchObject({ analysisStatus: "FAILED", analysisError: expect.not.stringContaining("private") });
});
it("keeps earlier assessments when a later database write fails", async () => {
  const { id } = await imported();
  let writes = 0;
  const failing = { ...repository, save: async (...args: Parameters<typeof repository.save>) => {
    if (++writes === 2) throw new Error("private database detail");
    await repository.save(...args);
  } };
  expect(await analyzeGame(id, failing, () => ({ engine: mockEngine(), configuration: settings }))).toHaveProperty("status", "FAILED");
  expect(await db.moveEngineAnalysis.count({ where: { move: { gameId: id } } })).toBe(1);
  expect((await db.game.findUniqueOrThrow({ where: { id } })).analysisStatus).toBe("FAILED");
});
it("handles a setup-position stalemate as a board-proven draw", async () => {
  const parsed = parsePgn('[SetUp "1"]\n[FEN "7k/8/5QK1/8/8/8/8/8 w - - 0 1"]\n\n1. Qf7 1/2-1/2');
  const { id } = await createImportRepository(db).create(parsed, "WHITE");
  ids.push(id);
  const engine = mockEngine();
  expect(await analyzeGame(id, repository, () => ({ engine, configuration: settings }))).toHaveProperty("status", "ENGINE_COMPLETED");
  expect(engine.analyze).toHaveBeenCalledTimes(1);
  const saved = await db.moveEngineAnalysis.findFirstOrThrow({ where: { move: { gameId: id } } });
  expect(saved).toMatchObject({ afterCp: 0, afterMate: null });
  expect(saved.assessment).toMatchObject({ facts: { terminal: "draw" } });
});
it("allows only one simultaneous analysis request to start an engine", async () => {
  const { id } = await imported();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const engine = mockEngine();
  const original = engine.analyze.getMockImplementation()!;
  engine.analyze.mockImplementation(async fen => { await gate; return original(fen); });
  const factory = vi.fn(() => ({ engine, configuration: settings }));
  const first = analyzeGame(id, createAnalysisRepository(db), factory);
  await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
  expect(await analyzeGame(id, createAnalysisRepository(db), factory)).toEqual({ status: "NOT_READY" });
  release();
  expect(await first).toHaveProperty("status", "ENGINE_COMPLETED");
  expect(factory).toHaveBeenCalledOnce();
});
it("recovers expired ownership and fences stale writes/status updates", async () => {
  const { id } = await imported();
  const old = createAnalysisRepository(db);
  expect(await old.claim(id)).toBe(true);
  await db.game.update({ where: { id }, data: { analysisLeaseUntil: new Date(0) } });
  expect(await analyzeGame(id, createAnalysisRepository(db), () => ({ engine: mockEngine(), configuration: settings }))).toHaveProperty("status", "ENGINE_COMPLETED");
  const row = await db.moveEngineAnalysis.findFirstOrThrow({ where: { move: { gameId: id } } });
  await expect(old.save(row.moveId, { runId: "stale", assessment: row.assessment as unknown as import("@/types/analysis").MoveAssessment, configuration: settings, bestMoveSan: row.bestMoveSan, pvSan: row.pvSan })).rejects.toThrow(/ownership/);
  await old.fail(id, "Old failure");
  await expect(old.complete(id)).rejects.toThrow(/ownership/);
  expect(await db.game.findUniqueOrThrow({ where: { id } })).toMatchObject({ analysisStatus: "ENGINE_COMPLETED", analysisError: null, analysisToken: null, analysisLeaseUntil: null });
});
it("recovers legacy interrupted running rows without a lease", async () => {
  const { id } = await imported();
  await db.game.update({ where: { id }, data: { analysisStatus: "ENGINE_RUNNING" } });
  expect(await analyzeGame(id, createAnalysisRepository(db), () => ({ engine: mockEngine(), configuration: settings }))).toHaveProperty("status", "ENGINE_COMPLETED");
});
it("exposes persisted engine facts through the detail DTO without bloating summaries", async () => {
  const { findGame, listGames } = await import("@/lib/games/queries");
  const { id } = await imported();
  await analyzeGame(id, createAnalysisRepository(db), () => ({ engine: mockEngine(), configuration: settings }));
  const saved = await findGame(db, id);
  expect(saved!.game.moves[0].analysis).toMatchObject({ before: { score: { value: 25 } }, after: { score: { value: -25 } }, quality: "mistake", cpLoss: 50, bestMoveSan: expect.any(String), pvSan: [expect.any(String)] });
  expect((await listGames(db)).find(game => game.id === id)).not.toHaveProperty("moves");
});
