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
