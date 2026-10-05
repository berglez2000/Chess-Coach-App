import { pgnReviewMetadata } from "@/lib/pgn/review-metadata";
import { requireOwnerId } from "@/lib/auth/owner";
import { positiveHighlightPlies } from "@/lib/coaching/review-highlights";
import { toReviewAnalysis } from "@/lib/analysis/review";
import type { PrismaClient } from "@/generated/prisma/client";
import type { GameSummary, SavedGame, ReviewCoachingAnnotation, GameCoachingSummary } from "@/types/saved-game";
import type { GameResult } from "@/types/game";
import { COACHING_CATEGORIES, COACHING_CLASSIFICATIONS } from "@/lib/coaching/contract";

const summarySelect = {
  id: true, whiteName: true, blackName: true, result: true, playedAt: true,
  openingName: true, userColor: true, analysisStatus: true, createdAt: true,
} as const;

export async function listGames(db: PrismaClient, ownerId: string, limit?: number): Promise<GameSummary[]> {
  const games = await db.game.findMany({ where: { ownerId: requireOwnerId(ownerId) }, ...(limit === undefined ? {} : { take: limit }), select: summarySelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return games.map(({ analysisStatus, playedAt, createdAt, ...game }) => ({
    ...game, status: analysisStatus, playedAt: playedAt?.toISOString() ?? null, createdAt: createdAt.toISOString(),
  }));
}

/** Count all saved games while fetching only the five newest summaries. */
export async function getDashboard(db: PrismaClient, ownerId: string): Promise<{ count: number; recentGames: GameSummary[] }> {
  const [count, recentGames] = await Promise.all([db.game.count({ where: { ownerId: requireOwnerId(ownerId) } }), listGames(db, ownerId, 5)]);
  return { count, recentGames };
}

export async function findGame(db: PrismaClient, id: string, ownerId: string): Promise<SavedGame | null> {
  const stored = await db.game.findUnique({ where: { id, ownerId: requireOwnerId(ownerId) }, select: {
    ...summarySelect, analysisError: true, analysisLeaseUntil: true, initialFen: true, event: true, site: true, round: true,
    eco: true, timeControl: true, termination: true, pgn: true,
    coachingProvider: true, coachingRevision: true, coachingSummary: true, coachingStrengths: true, coachingImprovements: true, coachingModel: true,
    moves: { orderBy: { ply: "asc" }, select: {
      engineAnalysis: { select: { assessment: true, bestMoveSan: true, pvSan: true, runId: true, analyzedAt: true } },
      coachingAnnotation: { select: { classification: true, headline: true, explanation: true, lesson: true, category: true, model: true, provider: true } },
      ply: true, moveNumber: true, color: true, san: true, uci: true, fenBefore: true, fenAfter: true,
    } },
  } });
  if (!stored) return null;
  const { whiteName, blackName, result, openingName, event, site, round, eco, timeControl, termination } = stored;
  const display = pgnReviewMetadata(stored.pgn ?? "");
  const playedAt = stored.playedAt?.toISOString() ?? null;

  const coaching: GameCoachingSummary | null =
    stored.coachingSummary && stored.coachingModel
      ? { summary: stored.coachingSummary, strengths: stored.coachingStrengths, improvements: stored.coachingImprovements, model: stored.coachingModel, provider: stored.coachingProvider ?? "ANTHROPIC" }
      : null;

  const positivePlies = positiveHighlightPlies(stored.userColor, stored.moves);

  return {
    coachingRevision: stored.coachingRevision,
    id: stored.id, whiteName, blackName, result, playedAt, openingName, userColor: stored.userColor,
    status: stored.analysisStatus, createdAt: stored.createdAt.toISOString(),
    analysisError: stored.analysisError, analysisLeaseUntil: stored.analysisLeaseUntil?.toISOString() ?? null,
    game: {
      initialFen: stored.initialFen,
      coaching,
      moves: stored.moves.map(({ engineAnalysis, coachingAnnotation, ...move }) => ({
        ...move,
        ...(display.clocks[move.ply] !== undefined ? { clockSeconds: display.clocks[move.ply] } : {}),
        ...(positivePlies.has(move.ply) ? { positiveHighlight: true } : {}),
        analysis: toReviewAnalysis(engineAnalysis),
        coaching: toReviewCoachingAnnotation(coachingAnnotation),
      })),
      metadata: { ...(display.whiteRating ? { whiteRating: display.whiteRating } : {}), ...(display.blackRating ? { blackRating: display.blackRating } : {}), whiteName, blackName, result: result as GameResult, playedAt, openingName, event, site, round, eco, timeControl, termination },
    },
  };
}

function toReviewCoachingAnnotation(
  row: { classification: string; headline: string | null; explanation: string; lesson: string; category: string; model: string; provider: import("@/lib/coaching/providers").CoachingProvider } | null,
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
    provider: row.provider,
  };
}
