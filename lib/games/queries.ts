import { toReviewAnalysis } from "@/lib/analysis/review";
import type { PrismaClient } from "@/generated/prisma/client";
import type { GameSummary, SavedGame } from "@/types/saved-game";
import type { GameResult } from "@/types/game";

const summarySelect = {
  id: true, whiteName: true, blackName: true, result: true, playedAt: true,
  openingName: true, userColor: true, analysisStatus: true, createdAt: true,
} as const;

export async function listGames(db: PrismaClient): Promise<GameSummary[]> {
  const games = await db.game.findMany({ select: summarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return games.map(({ analysisStatus, playedAt, createdAt, ...game }) => ({
    ...game, status: analysisStatus, playedAt: playedAt?.toISOString() ?? null, createdAt: createdAt.toISOString(),
  }));
}

export async function findGame(db: PrismaClient, id: string): Promise<SavedGame | null> {
  const stored = await db.game.findUnique({ where: { id }, select: {
    ...summarySelect, analysisError: true, analysisLeaseUntil: true, initialFen: true, event: true, site: true, round: true,
    eco: true, timeControl: true, termination: true,
    moves: { orderBy: { ply: "asc" }, select: {
      engineAnalysis: { select: { assessment: true, bestMoveSan: true, pvSan: true, runId: true, analyzedAt: true } },
      ply: true, moveNumber: true, color: true, san: true, uci: true, fenBefore: true, fenAfter: true,
    } },
  } });
  if (!stored) return null;
  const { whiteName, blackName, result, openingName, event, site, round, eco, timeControl, termination } = stored;
  const playedAt = stored.playedAt?.toISOString() ?? null;
  return {
    id: stored.id, whiteName, blackName, result, playedAt, openingName, userColor: stored.userColor,
    status: stored.analysisStatus, createdAt: stored.createdAt.toISOString(),
    analysisError: stored.analysisError, analysisLeaseUntil: stored.analysisLeaseUntil?.toISOString() ?? null,
    game: { initialFen: stored.initialFen, moves: stored.moves.map(({ engineAnalysis, ...move }) => ({ ...move, analysis: toReviewAnalysis(engineAnalysis) })), metadata: {
      whiteName, blackName, result: result as GameResult, playedAt, openingName, event, site, round, eco, timeControl, termination,
    } },
  };
}
