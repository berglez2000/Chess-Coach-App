import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AnalysisRepository } from "./orchestrate";

export function createAnalysisRepository(db: PrismaClient): AnalysisRepository {
  return {
    load: id => db.game.findUnique({ where: { id }, select: { initialFen: true, moves: { orderBy: { ply: "asc" }, select: {
      id: true, ply: true, moveNumber: true, color: true, san: true, uci: true, fenBefore: true, fenAfter: true,
    } } } }),
    async claim(id) {
      const result = await db.game.updateMany({ where: { id, analysisStatus: { in: ["PENDING", "FAILED"] } }, data: { analysisStatus: "ENGINE_RUNNING", analysisError: null } });
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
      await db.moveEngineAnalysis.upsert({ where: { moveId }, create: { moveId, ...data }, update: data });
    },
    async complete(id) { await db.game.update({ where: { id }, data: { analysisStatus: "ENGINE_COMPLETED", analysisError: null } }); },
    async fail(id, message) { await db.game.update({ where: { id }, data: { analysisStatus: "FAILED", analysisError: message } }); },
  };
}
