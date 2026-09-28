import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { analyzeGame, type AnalysisConfiguration } from "@/lib/analysis/orchestrate";
import { createAnalysisRepository } from "@/lib/analysis/repository";
import { coachGame } from "@/lib/coaching/orchestrate";
import { createCoachingRepository } from "@/lib/coaching/repository";
import { createImportRepository } from "@/lib/games/import-repository";
import { parsePgn } from "@/lib/pgn/parse";
import type { EngineResult } from "@/types/engine";
import type { CoachingClient } from "@/lib/coaching/ai-client";
import type { CoachingAnnotation } from "@/lib/coaching/contract";
import { assertTestDatabase, createTestDb } from "../support/database";
import { Chess } from "chess.js";

const db = createTestDb();
const ids: string[] = [];
const engineSettings: AnalysisConfiguration = {
  engine: "Stockfish", adapterVersion: 1, depth: 12, moveTimeMs: null, timeoutMs: 30000, threads: 1, hashMb: 16, multiPv: 1,
};

async function importAndAnalyze(pgn = "1. e4 e5 2. Nf3 Nc6 3. Bc4 *") {
  const game = parsePgn(`[Event "coaching-${randomUUID()}"]\n\n${pgn}`);
  const { id } = await createImportRepository(db).create(game, "WHITE");
  ids.push(id);
  const analysisRepo = createAnalysisRepository(db);
  await analyzeGame(id, analysisRepo, () => ({ engine: mockEngine(), configuration: engineSettings }));
  return id;
}

function mockEngine() {
  return {
    analyze: vi.fn(async (fen: string): Promise<EngineResult> => {
      const board = new Chess(fen);
      const legal = board.moves({ verbose: true });
      const best = legal[0];
      const uci = best.from + best.to + (best.promotion ?? "");
      return {
        perspective: board.turn() === "w" ? "WHITE" : "BLACK",
        bestMove: uci,
        evaluation: { depth: 12, score: { kind: "cp", value: 25, bound: "exact" }, pv: [uci] },
      };
    }),
  };
}

function makeAnnotation(ply: number): CoachingAnnotation {
  return {
    schemaVersion: 1,
    summary: "Good opening with missed opportunities.",
    strengths: ["Central control"],
    improvements: ["Look for tactics"],
    moments: ply > 0 ? [{
      ply,
      engineQuality: "mistake",
      modelClassification: "mistake",
      effectiveClassification: "mistake",
      headline: "Missed fork",
      explanation: "This allows a fork next move.",
      lesson: "Look for knight forks on central squares.",
      category: "tactics.fork",
    }] : [],
    model: "claude-haiku-4-5",
  };
}

function makeClient(annotation: CoachingAnnotation): CoachingClient {
  return { requestCoaching: vi.fn().mockResolvedValue({ status: "OK", annotation }) };
}

beforeAll(async () => { await assertTestDatabase(db); });
afterEach(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
});
afterAll(async () => { await db.$disconnect(); });

it("saves summary and annotations transactionally, sets COMPLETED", async () => {
  const id = await importAndAnalyze();
  const stored = await db.game.findUniqueOrThrow({ where: { id }, include: { moves: { orderBy: { ply: "asc" } } } });
  const firstPly = stored.moves[0].ply;
  const annotation = makeAnnotation(firstPly);
  const repo = createCoachingRepository(db);
  const result = await coachGame(id, repo, makeClient(annotation));

  expect(result).toEqual({ status: "COMPLETED", annotatedMoments: 1 });

  const completed = await db.game.findUniqueOrThrow({ where: { id } });
  expect(completed.analysisStatus).toBe("COMPLETED");
  expect(completed.coachingSummary).toBe(annotation.summary);
  expect(completed.coachingStrengths).toEqual(annotation.strengths);
  expect(completed.coachingImprovements).toEqual(annotation.improvements);
  expect(completed.coachingModel).toBe("claude-haiku-4-5");
  expect(completed.analysisToken).toBeNull();

  const ann = await db.moveCoachingAnnotation.findFirst({ where: { move: { gameId: id } }, include: { move: { select: { ply: true } } } });
  expect(ann).not.toBeNull();
  expect(ann!.move.ply).toBe(firstPly);
  expect(ann!.explanation).toBe("This allows a fork next move.");
  expect(ann!.category).toBe("tactics.fork");
});

it("saves summary with no annotations when no moments selected", async () => {
  const id = await importAndAnalyze();
  const annotation = makeAnnotation(0);
  const repo = createCoachingRepository(db);
  const result = await coachGame(id, repo, makeClient(annotation));

  expect(result).toEqual({ status: "COMPLETED", annotatedMoments: 0 });

  const completed = await db.game.findUniqueOrThrow({ where: { id } });
  expect(completed.analysisStatus).toBe("COMPLETED");
  expect(completed.coachingSummary).toBe(annotation.summary);
  expect(await db.moveCoachingAnnotation.count({ where: { move: { gameId: id } } })).toBe(0);
});

it("leaves game as ENGINE_COMPLETED and sets error message when AI fails", async () => {
  const id = await importAndAnalyze();
  const repo = createCoachingRepository(db);
  const client: CoachingClient = { requestCoaching: vi.fn().mockResolvedValue({ status: "MISSING_KEY" }) };
  const result = await coachGame(id, repo, client);

  expect(result.status).toBe("AI_FAILED");
  const game = await db.game.findUniqueOrThrow({ where: { id } });
  expect(game.analysisStatus).toBe("ENGINE_COMPLETED");
  expect(game.analysisError).toContain("ANTHROPIC_API_KEY");
  expect(game.analysisToken).toBeNull();
  expect(await db.moveCoachingAnnotation.count({ where: { move: { gameId: id } } })).toBe(0);
  expect(game.coachingSummary).toBeNull();
});

it("retry after AI failure re-runs coaching without duplicating annotations", async () => {
  const id = await importAndAnalyze();
  const stored = await db.game.findUniqueOrThrow({ where: { id }, include: { moves: { orderBy: { ply: "asc" } } } });
  const firstPly = stored.moves[0].ply;
  const annotation = makeAnnotation(firstPly);

  // First attempt: AI fails
  const repo1 = createCoachingRepository(db);
  const failClient: CoachingClient = { requestCoaching: vi.fn().mockResolvedValue({ status: "TIMEOUT" }) };
  await coachGame(id, repo1, failClient);

  // Retry: succeeds
  const repo2 = createCoachingRepository(db);
  const result = await coachGame(id, repo2, makeClient(annotation));
  expect(result).toEqual({ status: "COMPLETED", annotatedMoments: 1 });

  const count = await db.moveCoachingAnnotation.count({ where: { move: { gameId: id } } });
  expect(count).toBe(1);
  const game = await db.game.findUniqueOrThrow({ where: { id } });
  expect(game.analysisStatus).toBe("COMPLETED");
});

it("second concurrent claim returns NOT_READY", async () => {
  const id = await importAndAnalyze();
  const repo1 = createCoachingRepository(db);
  const repo2 = createCoachingRepository(db);

  expect(await repo1.claim(id)).toBe(true);
  expect(await repo2.claim(id)).toBe(false);
});

it("returns NOT_FOUND for unknown game id", async () => {
  const repo = createCoachingRepository(db);
  const result = await coachGame("nonexistent-id", repo, { requestCoaching: vi.fn() });
  expect(result).toEqual({ status: "NOT_FOUND" });
});

it("recovers interrupted coaching, fences the old owner, and preserves engine results", async () => {
  const id = await importAndAnalyze();
  const before = await db.moveEngineAnalysis.findMany({ where: { move: { gameId: id } } });
  const old = createCoachingRepository(db);
  expect(await old.claim(id)).toBe(true);
  expect(await createCoachingRepository(db).claim(id)).toBe(false);
  await db.game.update({ where: { id }, data: { analysisLeaseUntil: new Date(Date.now() - 1000) } });
  expect((await coachGame(id, createCoachingRepository(db), makeClient(makeAnnotation(0)))).status).toBe("COMPLETED");
  await expect(old.save(id, "late", makeAnnotation(0), new Map())).rejects.toThrow("ownership expired");
  await old.fail(id, "Late failure");
  expect((await db.game.findUniqueOrThrow({ where: { id } })).analysisStatus).toBe("COMPLETED");
  expect(await db.moveEngineAnalysis.findMany({ where: { move: { gameId: id } } })).toEqual(before);
});

it("does not claim partial failed engine work for coaching", async () => {
  const id = await importAndAnalyze();
  await db.game.update({ where: { id }, data: { analysisStatus: "FAILED" } });
  expect(await createCoachingRepository(db).claim(id)).toBe(false);
});

it("replaces coaching across providers atomically, removes obsolete annotations, and rejects stale revisions", async () => {
  const id = await importAndAnalyze();
  const engineBefore = await db.moveEngineAnalysis.findMany({ where: { move: { gameId: id } }, orderBy: { id: "asc" } });
  await coachGame(id, createCoachingRepository(db), makeClient(makeAnnotation(1)));
  const first = await db.game.findUniqueOrThrow({ where: { id } });
  expect(first.coachingProvider).toBe("ANTHROPIC");
  const options = { provider: "OPENAI" as const, model: "gpt-fixture", expectedRevision: first.coachingRevision };
  const replacement = { ...makeAnnotation(3), model: "gpt-response-model", summary: "Replacement coaching" };
  expect((await coachGame(id, createCoachingRepository(db, options), makeClient(replacement), "OPENAI")).status).toBe("COMPLETED");
  const after = await db.game.findUniqueOrThrow({ where: { id } });
  expect(after).toMatchObject({ coachingSummary: replacement.summary, coachingProvider: "OPENAI", coachingModel: "gpt-response-model", coachingRunProvider: "OPENAI", coachingRunModel: "gpt-fixture", analysisStatus: "COMPLETED", coachingRevision: first.coachingRevision + 1 });
  const annotations = await db.moveCoachingAnnotation.findMany({ where: { move: { gameId: id } }, include: { move: true } });
  expect(annotations).toHaveLength(1);
  expect(annotations[0]).toMatchObject({ provider: "OPENAI", model: "gpt-response-model", move: { ply: 3 } });
  expect(await createCoachingRepository(db, options).claim(id)).toBe(false);
  expect(await createCoachingRepository(db).claim(id)).toBe(false);
  expect(await db.moveEngineAnalysis.findMany({ where: { move: { gameId: id } }, orderBy: { id: "asc" } })).toEqual(engineBefore);
});

it("preserves previous coaching after provider and transactional replacement failures", async () => {
  const id = await importAndAnalyze();
  await coachGame(id, createCoachingRepository(db), makeClient(makeAnnotation(1)));
  const original = await db.moveCoachingAnnotation.findMany({ where: { move: { gameId: id } } });
  const initial = await db.game.findUniqueOrThrow({ where: { id } });
  const options = { provider: "OPENAI" as const, model: "gpt-fixture", expectedRevision: initial.coachingRevision };
  await coachGame(id, createCoachingRepository(db, options), { requestCoaching: async () => ({ status: "MISSING_KEY" }) }, "OPENAI");
  const failed = await db.game.findUniqueOrThrow({ where: { id } });
  expect(failed).toMatchObject({ analysisStatus: "COMPLETED", coachingSummary: initial.coachingSummary, coachingProvider: "ANTHROPIC", coachingModel: initial.coachingModel, analysisError: expect.stringContaining("OPENAI_API_KEY") });
  const repo = createCoachingRepository(db, { ...options, expectedRevision: failed.coachingRevision });
  expect(await repo.claim(id)).toBe(true);
  // Fail after summary update/deletion inside the transaction, testing rollback.
  await expect(repo.save(id, "broken", makeAnnotation(999), new Map())).rejects.toThrow("No move ID");
  await repo.fail(id, "Safe replacement failure");
  expect(await db.moveCoachingAnnotation.findMany({ where: { move: { gameId: id } } })).toEqual(original);
  expect(await db.game.findUniqueOrThrow({ where: { id } })).toMatchObject({ analysisStatus: "COMPLETED", coachingSummary: initial.coachingSummary, coachingProvider: "ANTHROPIC" });
});

it("recovers interrupted regeneration and fences late success/failure without losing the old review", async () => {
  const id = await importAndAnalyze();
  await coachGame(id, createCoachingRepository(db), makeClient(makeAnnotation(1)));
  const first = await db.game.findUniqueOrThrow({ where: { id } });
  const old = createCoachingRepository(db, { provider: "OPENAI", model: "gpt-fixture", expectedRevision: first.coachingRevision });
  expect(await old.claim(id)).toBe(true);
  expect(await createCoachingRepository(db).claim(id)).toBe(false);
  expect(await db.moveCoachingAnnotation.count({ where: { move: { gameId: id } } })).toBe(1);
  await db.game.update({ where: { id }, data: { analysisLeaseUntil: new Date(Date.now() - 1000) } });
  await old.fail(id, "Expired failure");
  expect((await db.game.findUniqueOrThrow({ where: { id } })).analysisStatus).toBe("AI_RUNNING");
  await coachGame(id, createCoachingRepository(db), makeClient(makeAnnotation(0)));
  await expect(old.save(id, "late", makeAnnotation(0), new Map())).rejects.toThrow("ownership expired");
  await old.fail(id, "Late failure");
  expect((await db.game.findUniqueOrThrow({ where: { id } })).analysisStatus).toBe("COMPLETED");
  expect(await db.moveCoachingAnnotation.count({ where: { move: { gameId: id } } })).toBe(0);
});
