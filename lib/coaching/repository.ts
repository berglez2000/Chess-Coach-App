import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { CoachingAnnotation } from "@/lib/coaching/contract";
import type { MomentFacts } from "@/lib/coaching/prompt";
import type { MoveAssessment } from "@/types/analysis";

export const COACHING_LEASE_MS = 300_000;

export interface CoachingLoadResult {
  game: {
    userColor: "WHITE" | "BLACK";
    initialFen: string;
    whiteName: string | null;
    blackName: string | null;
    result: string;
    playedAt: string | null;
    openingName: string | null;
    event: string | null;
    eco: string | null;
    timeControl: string | null;
  };
  moves: Array<{
    id: string;
    ply: number;
    san: string;
    uci: string;
    color: "WHITE" | "BLACK";
    fenBefore: string;
    fenAfter: string;
    assessment: MoveAssessment | null;
    facts: MomentFacts | null;
  }>;
}

export interface CoachingRepository {
  load(id: string): Promise<CoachingLoadResult | null>;
  claim(id: string): Promise<boolean>;
  save(gameId: string, runId: string, annotation: CoachingAnnotation, moveIds: Map<number, string>): Promise<void>;
  complete(id: string): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}

export function createCoachingRepository(db: PrismaClient): CoachingRepository {
  const token = randomUUID();
  const lease = () => new Date(Date.now() + COACHING_LEASE_MS);

  return {
    async load(id) {
      const stored = await db.game.findUnique({
        where: { id },
        select: {
          userColor: true, initialFen: true, whiteName: true, blackName: true,
          result: true, playedAt: true, openingName: true, event: true, eco: true, timeControl: true,
          moves: {
            orderBy: { ply: "asc" },
            select: {
              id: true, ply: true, san: true, uci: true, color: true, fenBefore: true, fenAfter: true,
              engineAnalysis: {
                select: { assessment: true, bestMoveSan: true, bestMoveUci: true, pvSan: true,
                  beforeCp: true, beforeMate: true, afterCp: true, afterMate: true },
              },
            },
          },
        },
      });
      if (!stored) return null;

      const moves = stored.moves.map(move => {
        const eng = move.engineAnalysis;
        if (!eng) return { id: move.id, ply: move.ply, san: move.san, uci: move.uci, color: move.color, fenBefore: move.fenBefore, fenAfter: move.fenAfter, assessment: null, facts: null };

        const raw = eng.assessment as Record<string, unknown>;
        const assessment = isValidAssessment(raw) ? raw as unknown as MoveAssessment : null;

        const facts: MomentFacts | null = assessment ? {
          ply: move.ply,
          san: move.san,
          uci: move.uci,
          mover: move.color,
          fenBefore: move.fenBefore,
          fenAfter: move.fenAfter,
          before: assessment.facts.before,
          after: assessment.facts.after,
          bestMoveSan: eng.bestMoveSan,
          bestMoveUci: eng.bestMoveUci,
          pvSan: eng.pvSan,
        } : null;

        return { id: move.id, ply: move.ply, san: move.san, uci: move.uci, color: move.color, fenBefore: move.fenBefore, fenAfter: move.fenAfter, assessment, facts };
      });

      return {
        game: {
          userColor: stored.userColor,
          initialFen: stored.initialFen,
          whiteName: stored.whiteName,
          blackName: stored.blackName,
          result: stored.result,
          playedAt: stored.playedAt?.toISOString() ?? null,
          openingName: stored.openingName,
          event: stored.event,
          eco: stored.eco,
          timeControl: stored.timeControl,
        },
        moves,
      };
    },

    async claim(id) {
      const result = await db.game.updateMany({
        where: {
          id,
          OR: [
            { analysisStatus: "ENGINE_COMPLETED" },
            { analysisStatus: "AI_RUNNING", analysisLeaseUntil: { lt: new Date() } },
            { analysisStatus: "AI_RUNNING", analysisLeaseUntil: null },
            { analysisStatus: "FAILED" },
          ],
        },
        data: { analysisStatus: "AI_RUNNING", analysisError: null, analysisToken: token, analysisLeaseUntil: lease() },
      });
      return result.count === 1;
    },

    async save(gameId, runId, annotation, moveIds) {
      await db.$transaction(async tx => {
        const owned = await tx.game.updateMany({
          where: { id: gameId, analysisToken: token, analysisStatus: "AI_RUNNING", analysisLeaseUntil: { gt: new Date() } },
          data: { analysisLeaseUntil: lease() },
        });
        if (owned.count !== 1) throw new Error("Coaching ownership expired.");

        await tx.game.update({
          where: { id: gameId },
          data: {
            coachingSummary: annotation.summary,
            coachingStrengths: annotation.strengths,
            coachingImprovements: annotation.improvements,
            coachingModel: annotation.model,
          },
        });

        for (const moment of annotation.moments) {
          const moveId = moveIds.get(moment.ply);
          if (!moveId) throw new Error(`No move ID for ply ${moment.ply}.`);
          const data: Prisma.MoveCoachingAnnotationCreateInput = {
            move: { connect: { id: moveId } },
            runId,
            classification: moment.effectiveClassification,
            headline: moment.headline ?? undefined,
            explanation: moment.explanation,
            lesson: moment.lesson,
            category: moment.category,
            model: annotation.model,
          };
          await tx.moveCoachingAnnotation.upsert({
            where: { moveId },
            create: data,
            update: {
              runId, classification: moment.effectiveClassification,
              headline: moment.headline ?? null, explanation: moment.explanation,
              lesson: moment.lesson, category: moment.category, model: annotation.model,
            },
          });
        }
      });
    },

    async complete(id) {
      const result = await db.game.updateMany({
        where: { id, analysisToken: token, analysisStatus: "AI_RUNNING", analysisLeaseUntil: { gt: new Date() } },
        data: { analysisStatus: "COMPLETED", analysisError: null, analysisToken: null, analysisLeaseUntil: null },
      });
      if (result.count !== 1) throw new Error("Coaching ownership expired.");
    },

    async fail(id, message) {
      await db.game.updateMany({
        where: { id, analysisToken: token, analysisStatus: "AI_RUNNING" },
        data: { analysisStatus: "ENGINE_COMPLETED", analysisError: message, analysisToken: null, analysisLeaseUntil: null },
      });
    },
  };
}

function isValidAssessment(raw: Record<string, unknown>): boolean {
  return typeof raw === "object" && raw !== null && raw.policyVersion === 1 && typeof raw.quality === "string";
}
