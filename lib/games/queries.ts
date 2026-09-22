import { toReviewAnalysis } from "@/lib/analysis/review";
import type { PrismaClient } from "@/generated/prisma/client";
import type { GameSummary, SavedGame, ReviewCoachingAnnotation, GameCoachingSummary } from "@/types/saved-game";
import type { GameResult } from "@/types/game";
import { COACHING_CATEGORIES, COACHING_CLASSIFICATIONS } from "@/lib/coaching/contract";

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
    coachingSummary: true, coachingStrengths: true, coachingImprovements: true, coachingModel: true,
    moves: { orderBy: { ply: "asc" }, select: {
      engineAnalysis: { select: { assessment: true, bestMoveSan: true, pvSan: true, runId: true, analyzedAt: true } },
      coachingAnnotation: { select: { classification: true, headline: true, explanation: true, lesson: true, category: true, model: true } },
      ply: true, moveNumber: true, color: true, san: true, uci: true, fenBefore: true, fenAfter: true,
    } },
  } });
  if (!stored) return null;
  const { whiteName, blackName, result, openingName, event, site, round, eco, timeControl, termination } = stored;
  const playedAt = stored.playedAt?.toISOString() ?? null;

  const coaching: GameCoachingSummary | null =
    stored.coachingSummary && stored.coachingModel
      ? { summary: stored.coachingSummary, strengths: stored.coachingStrengths, improvements: stored.coachingImprovements, model: stored.coachingModel }
      : null;

  return {
    id: stored.id, whiteName, blackName, result, playedAt, openingName, userColor: stored.userColor,
    status: stored.analysisStatus, createdAt: stored.createdAt.toISOString(),
    analysisError: stored.analysisError, analysisLeaseUntil: stored.analysisLeaseUntil?.toISOString() ?? null,
    game: {
      initialFen: stored.initialFen,
      coaching,
      moves: stored.moves.map(({ engineAnalysis, coachingAnnotation, ...move }) => ({
        ...move,
        analysis: toReviewAnalysis(engineAnalysis),
        coaching: toReviewCoachingAnnotation(coachingAnnotation),
      })),
      metadata: { whiteName, blackName, result: result as GameResult, playedAt, openingName, event, site, round, eco, timeControl, termination },
    },
  };
}

function toReviewCoachingAnnotation(
  row: { classification: string; headline: string | null; explanation: string; lesson: string; category: string; model: string } | null,
): ReviewCoachingAnnotation | null {
  if (!row) return null;
  if (!(COACHING_CLASSIFICATIONS as readonly string[]).includes(row.classification)) return null;
  if (!(COACHING_CATEGORIES as readonly string[]).includes(row.category)) return null;
  return {
    classification: row.classification as ReviewCoachingAnnotation["classification"],
    headline: row.headline,
    explanation: row.explanation,
    lesson: row.lesson,
    category: row.category as ReviewCoachingAnnotation["category"],
    model: row.model,
  };
}
