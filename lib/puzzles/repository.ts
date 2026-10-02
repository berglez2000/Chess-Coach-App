import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { PUZZLE_POLICY } from "./policy";
import type { PuzzleRepository } from "./generate";
import { readSolution } from "./sequence";

export const PUZZLE_LEASE_MS = 300_000;
export const PUZZLE_FAILURE = "Puzzle generation failed. Check Stockfish and the database, then retry. Your review is still available.";

export async function puzzleSummary(db: PrismaClient, gameId: string, ownerId: string) {
  const row = await db.puzzleGeneration.findFirst({
    where: { gameId, version: PUZZLE_POLICY.version, game: { ownerId: requireOwnerId(ownerId) } },
    select: { status: true, error: true, checkedCandidates: true, leaseUntil: true, _count: { select: { puzzles: true } } },
  });
  return row ? { status: row.status, error: row.error, checkedCandidates: row.checkedCandidates,
    leaseUntil: row.leaseUntil?.toISOString() ?? null, count: row._count.puzzles } : null;
}

export function createPuzzleRepository(db: PrismaClient, owner: string): PuzzleRepository {
  const ownerId = requireOwnerId(owner);
  const token = randomUUID();
  const owned = (gameId: string) => ({ gameId, version: PUZZLE_POLICY.version, game: { ownerId } });
  return {
    load: id => db.game.findUnique({ where: { id, ownerId }, select: {
      userColor: true, analysisStatus: true, moves: { orderBy: { ply: "asc" }, select: {
        ply: true, color: true, fenBefore: true, uci: true,
        engineAnalysis: { select: { runId: true, cpLoss: true, classification: true, bestMoveUci: true } },
      } },
    } }),
    async claim(id) {
      // Recheck ownership at the mutation boundary; concurrent creates are harmless.
      const game = await db.game.findUnique({ where: { id, ownerId }, select: { id: true } });
      if (!game) throw new Error("Game unavailable.");
      await db.puzzleGeneration.createMany({ data: [{ gameId: id, version: PUZZLE_POLICY.version, configuration: PUZZLE_POLICY }], skipDuplicates: true });
      const result = await db.puzzleGeneration.updateMany({ where: { ...owned(id), OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "RUNNING", leaseUntil: { lt: new Date() } },
      ] }, data: { status: "RUNNING", token, leaseUntil: new Date(Date.now() + PUZZLE_LEASE_MS), error: null } });
      if (result.count === 1) return "CLAIMED";
      const saved = await db.puzzleGeneration.findFirst({ where: owned(id), select: { status: true } });
      return saved?.status === "COMPLETED" ? "COMPLETED" : "BUSY";
    },
    async complete(id, puzzles, checkedCandidates) {
      for (const puzzle of puzzles) readSolution(puzzle.solution, puzzle.startingFen, puzzle.acceptedMoves, puzzle.playerColor);
      await db.$transaction(async tx => {
        // Lock and fence the run before inserting. A superseded worker cannot publish.
        const updated = await tx.puzzleGeneration.updateMany({
          where: { ...owned(id), token, status: "RUNNING", leaseUntil: { gt: new Date() } },
          data: { status: "COMPLETED", token: null, leaseUntil: null, checkedCandidates, error: null },
        });
        if (updated.count !== 1) throw new Error("Puzzle generation ownership lost.");
        const generation = await tx.puzzleGeneration.findFirstOrThrow({ where: owned(id), select: { id: true } });
        if (puzzles.length) await tx.personalPuzzle.createMany({ data: puzzles.map(puzzle => ({
          ...puzzle, generationId: generation.id, validation: puzzle.validation as unknown as Prisma.InputJsonValue,
          solution: puzzle.solution as unknown as Prisma.InputJsonValue | undefined,
        })) });
      });
    },
    async renew(id) {
      const renewed = await db.puzzleGeneration.updateMany({
        where: { ...owned(id), token, status: "RUNNING", leaseUntil: { gt: new Date() } },
        data: { leaseUntil: new Date(Date.now() + PUZZLE_LEASE_MS) },
      });
      if (renewed.count !== 1) throw new Error("Puzzle generation ownership lost.");
    },
    async fail(id) {
      await db.puzzleGeneration.updateMany({ where: { ...owned(id), token, status: "RUNNING" },
        data: { status: "FAILED", token: null, leaseUntil: null, error: PUZZLE_FAILURE } });
    },
  };
}
