import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AnalysisRepository } from "./orchestrate";

export const ANALYSIS_LEASE_MS = 300_000;

/** Create one repository per run. The token fences writes from expired owners. */
export function createAnalysisRepository(db: PrismaClient): AnalysisRepository {
  const token = randomUUID();
  let gameId: string | undefined;
  const lease = () => new Date(Date.now() + ANALYSIS_LEASE_MS);
  return {
    load: id => db.game.findUnique({ where: { id }, select: { initialFen: true, moves: { orderBy: { ply: "asc" }, select: {
      id: true, ply: true, moveNumber: true, color: true, san: true, uci: true, fenBefore: true, fenAfter: true,
    } } } }),
    async claim(id) {
      const result = await db.game.updateMany({ where: { id, OR: [
        { analysisStatus: { in: ["PENDING", "FAILED"] } },
        { analysisStatus: "ENGINE_RUNNING", analysisLeaseUntil: { lt: new Date() } },
        { analysisStatus: "ENGINE_RUNNING", analysisLeaseUntil: null },
      ] }, data: { analysisStatus: "ENGINE_RUNNING", analysisError: null, analysisToken: token, analysisLeaseUntil: lease() } });
      if (result.count === 1) gameId = id;
      return result.count === 1;
    },
    async save(moveId, result) {
      const { assessment, configuration, runId, bestMoveSan, pvSan } = result;
      const before = assessment.facts.before?.score;
      const after = assessment.facts.after?.score;
      const data = {
        runId, beforeCp: before?.kind === "cp" ? before.value : null,
        beforeMate: before?.kind === "mate" ? before.value : null,
        afterCp: after?.kind === "cp" ? after.value : null,
        afterMate: after?.kind === "mate" ? after.value : null,
        bestMoveUci: assessment.facts.bestMove, bestMoveSan,
        pvUci: assessment.facts.before?.pv ?? [], pvSan,
        cpLoss: assessment.cpLoss, classification: assessment.quality,
        assessment: assessment as unknown as Prisma.InputJsonObject,
        configuration: configuration as unknown as Prisma.InputJsonObject,
        analyzedAt: new Date(),
      };
      if (!gameId) throw new Error("Analysis run has no ownership.");
      await db.$transaction(async tx => {
        const owned = await tx.game.updateMany({ where: { id: gameId, analysisToken: token, analysisStatus: "ENGINE_RUNNING", analysisLeaseUntil: { gt: new Date() } }, data: { analysisLeaseUntil: lease() } });
        if (owned.count !== 1) throw new Error("Analysis ownership expired.");
        const move = await tx.gameMove.findFirst({ where: { id: moveId, gameId }, select: { id: true } });
        if (!move) throw new Error("Move does not belong to this run.");
        await tx.moveEngineAnalysis.upsert({ where: { moveId }, create: { moveId, ...data }, update: data });
      });
    },
    async complete(id) { const result = await db.game.updateMany({ where: { id, analysisToken: token, analysisStatus: "ENGINE_RUNNING", analysisLeaseUntil: { gt: new Date() } }, data: { analysisStatus: "ENGINE_COMPLETED", analysisError: null, analysisToken: null, analysisLeaseUntil: null } });
      if (result.count !== 1) throw new Error("Analysis ownership expired."); },
    async fail(id, message) { await db.game.updateMany({ where: { id, analysisToken: token, analysisStatus: "ENGINE_RUNNING" }, data: { analysisStatus: "FAILED", analysisError: message, analysisToken: null, analysisLeaseUntil: null } }); },
  };
}
