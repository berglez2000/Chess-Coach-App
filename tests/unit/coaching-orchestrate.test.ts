import { expect, it, vi, describe } from "vitest";
import { coachGame } from "@/lib/coaching/orchestrate";
import type { CoachingRepository, CoachingLoadResult } from "@/lib/coaching/repository";
import type { CoachingClient } from "@/lib/coaching/ai-client";
import type { CoachingAnnotation } from "@/lib/coaching/contract";

const ENGINE_ASSESSMENT = {
  policyVersion: 1 as const,
  quality: "mistake" as const,
  reason: "cp_loss" as const,
  cpLoss: 150,
  rawCpLoss: 150,
  facts: {
    move: "e2e4",
    mover: "WHITE" as const,
    fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    terminal: null,
    legalMoveCount: 20,
    bestMove: "e2e4",
    before: { perspective: "WHITE" as const, score: { kind: "cp" as const, value: 25, bound: "exact" as const }, depth: 12, pv: ["e2e4"] },
    after: { perspective: "WHITE" as const, score: { kind: "cp" as const, value: -125, bound: "exact" as const }, depth: 12, pv: ["e7e5"] },
  },
};

function makeLoadResult(overrides: Partial<CoachingLoadResult> = {}): CoachingLoadResult {
  return {
    game: {
      userColor: "WHITE",
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      whiteName: "Alice",
      blackName: "Bob",
      result: "1-0",
      playedAt: null,
      openingName: null,
      event: null,
      eco: null,
      timeControl: null,
    },
    moves: [
      {
        id: "move-1",
        ply: 1,
        san: "e4",
        uci: "e2e4",
        color: "WHITE",
        fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        assessment: ENGINE_ASSESSMENT,
        facts: {
          ply: 1,
          san: "e4",
          uci: "e2e4",
          mover: "WHITE",
          fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          before: { perspective: "WHITE", score: { kind: "cp", value: 25, bound: "exact" }, depth: 12, pv: ["e2e4"] },
          after: { perspective: "WHITE", score: { kind: "cp", value: -125, bound: "exact" }, depth: 12, pv: ["e7e5"] },
          bestMoveSan: "e4",
          bestMoveUci: "e2e4",
          pvSan: ["e4"],
        },
      },
    ],
    ...overrides,
  };
}

const VALID_ANNOTATION: CoachingAnnotation = {
  schemaVersion: 1,
  summary: "Good opening, missed key moment.",
  strengths: ["Central control"],
  improvements: ["Check for tactics before each move"],
  moments: [
    {
      ply: 1,
      engineQuality: "mistake",
      modelClassification: "mistake",
      effectiveClassification: "mistake",
      headline: "Missed fork",
      explanation: "This move allows a fork.",
      lesson: "Look for knight forks.",
      category: "tactics.fork",
    },
  ],
  model: "claude-haiku-4-5",
};

function makeRepository(overrides: Partial<CoachingRepository> = {}): CoachingRepository {
  return {
    load: vi.fn().mockResolvedValue(makeLoadResult()),
    claim: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeClient(outcome: Parameters<CoachingClient["requestCoaching"]>[0] extends object ? object : never = { status: "OK", annotation: VALID_ANNOTATION }): CoachingClient {
  return { requestCoaching: vi.fn().mockResolvedValue(outcome) };
}

describe("coachGame", () => {
  it("returns COMPLETED with annotated moment count on success", async () => {
    const repo = makeRepository();
    const client = { requestCoaching: vi.fn().mockResolvedValue({ status: "OK", annotation: VALID_ANNOTATION }) };
    const result = await coachGame("game-1", repo, client);
    expect(result).toEqual({ status: "COMPLETED", annotatedMoments: 1 });
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.complete).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when repository.load returns null", async () => {
    const repo = makeRepository({ load: vi.fn().mockResolvedValue(null) });
    const client = { requestCoaching: vi.fn() };
    expect(await coachGame("game-1", repo, client)).toEqual({ status: "NOT_FOUND" });
    expect(client.requestCoaching).not.toHaveBeenCalled();
  });

  it("returns NO_ENGINE_DATA when moves have no assessments", async () => {
    const noEngine = makeLoadResult({ moves: [{ ...makeLoadResult().moves[0], assessment: null, facts: null }] });
    const repo = makeRepository({ load: vi.fn().mockResolvedValue(noEngine) });
    const client = { requestCoaching: vi.fn() };
    expect(await coachGame("game-1", repo, client)).toEqual({ status: "NO_ENGINE_DATA" });
    expect(client.requestCoaching).not.toHaveBeenCalled();
  });

  it("returns NOT_READY when claim returns false", async () => {
    const repo = makeRepository({ claim: vi.fn().mockResolvedValue(false) });
    const client = { requestCoaching: vi.fn() };
    expect(await coachGame("game-1", repo, client)).toEqual({ status: "NOT_READY" });
    expect(client.requestCoaching).not.toHaveBeenCalled();
  });

  it("returns AI_FAILED and calls fail when client returns MISSING_KEY", async () => {
    const repo = makeRepository();
    const client = { requestCoaching: vi.fn().mockResolvedValue({ status: "MISSING_KEY" }) };
    const result = await coachGame("game-1", repo, client);
    expect(result.status).toBe("AI_FAILED");
    if (result.status !== "AI_FAILED") return;
    expect(result.code).toBe("MISSING_KEY");
    expect(repo.fail).toHaveBeenCalledOnce();
    expect(repo.complete).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("returns AI_FAILED for each failure code", async () => {
    for (const code of ["REFUSAL", "INCOMPLETE_OUTPUT", "TIMEOUT", "RATE_LIMIT", "API_ERROR", "INVALID_RESPONSE"] as const) {
      const repo = makeRepository();
      const client = { requestCoaching: vi.fn().mockResolvedValue({ status: code, message: "err" }) };
      const result = await coachGame("game-1", repo, client);
      expect(result.status).toBe("AI_FAILED");
    }
  });

  it("returns STORAGE_FAILED when fail throws", async () => {
    const repo = makeRepository({ fail: vi.fn().mockRejectedValue(new Error("db down")) });
    const client = { requestCoaching: vi.fn().mockResolvedValue({ status: "MISSING_KEY" }) };
    const result = await coachGame("game-1", repo, client);
    expect(result).toEqual({ status: "FAILED", code: "STORAGE_FAILED", message: "Could not record coaching status. Check the database connection before retrying." });
  });

  it("returns FAILED/COACHING_FAILED when save throws unexpectedly", async () => {
    const repo = makeRepository({ save: vi.fn().mockRejectedValue(new Error("unexpected")) });
    const client = { requestCoaching: vi.fn().mockResolvedValue({ status: "OK", annotation: VALID_ANNOTATION }) };
    const result = await coachGame("game-1", repo, client);
    expect(result).toMatchObject({ status: "FAILED", code: "COACHING_FAILED" });
    expect(repo.fail).toHaveBeenCalledOnce();
  });

  it("passes moveIds map with correct ply→id mapping to save", async () => {
    const repo = makeRepository();
    const client = { requestCoaching: vi.fn().mockResolvedValue({ status: "OK", annotation: VALID_ANNOTATION }) };
    await coachGame("game-1", repo, client);
    const saveCall = (repo.save as ReturnType<typeof vi.fn>).mock.calls[0];
    const moveIds: Map<number, string> = saveCall[3];
    expect(moveIds.get(1)).toBe("move-1");
  });

  it("does not call fail when game is not claimed and load throws", async () => {
    const repo = makeRepository({ load: vi.fn().mockRejectedValue(new Error("db error")) });
    const client = { requestCoaching: vi.fn() };
    const result = await coachGame("game-1", repo, client);
    expect(result).toMatchObject({ status: "FAILED", code: "COACHING_FAILED" });
    expect(repo.fail).not.toHaveBeenCalled();
  });
});
