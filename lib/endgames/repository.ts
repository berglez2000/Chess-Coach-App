import type { PrismaClient, EndgameProgress as Row } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { ENDGAMES, type EndgamePosition } from "./catalog";
import { applyEndgameSnapshot, EMPTY_ENDGAME_PROGRESS, endgameVersion, snapshotSchema, type EndgameProgress, type EndgameSnapshot } from "./progress";
function dto(row: Row | null): EndgameProgress {
  return row ? { revision: row.revision, snapshot: row.snapshot ? snapshotSchema.parse(row.snapshot) : null, attempts: row.attempts, completedAt: row.completedAt?.toISOString() ?? null, completionAssisted: row.completionAssisted } : { ...EMPTY_ENDGAME_PROGRESS };
}
export async function getEndgameProgress(db: PrismaClient, userId: string, position: EndgamePosition) {
  return dto(await db.endgameProgress.findUnique({ where: { userId_positionId_version: { userId: requireOwnerId(userId), positionId: position.id, version: endgameVersion(position) } } }));
}
export async function listEndgameProgress(db: PrismaClient, userId: string) {
  const rows = await db.endgameProgress.findMany({ where: { userId: requireOwnerId(userId) } });
  return Object.fromEntries(ENDGAMES.map(position => [position.id, dto(rows.find(row => row.positionId === position.id && row.version === endgameVersion(position)) ?? null)]));
}
export async function saveEndgameProgress(db: PrismaClient, userId: string, position: EndgamePosition, input: { requestId: string; expectedRevision: number; snapshot: EndgameSnapshot }) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    const key = { userId, positionId: position.id, version: endgameVersion(position) };
    await tx.endgameProgress.createMany({ data: [key], skipDuplicates: true });
    const row = await tx.endgameProgress.findUniqueOrThrow({ where: { userId_positionId_version: key } });
    const duplicate = () => tx.endgameAction.findUnique({ where: { progressId_requestId: { progressId: row.id, requestId: input.requestId } } });
    const replay = async (action: NonNullable<Awaited<ReturnType<typeof duplicate>>>) => ({ status: action.expectedRevision === input.expectedRevision && JSON.stringify(snapshotSchema.parse(action.snapshot)) === JSON.stringify(input.snapshot) ? "OK" as const : "CONFLICT" as const, progress: dto(await tx.endgameProgress.findUniqueOrThrow({ where: { id: row.id } })) });
    const existing = await duplicate(); if (existing) return replay(existing);
    const claimed = await tx.endgameProgress.updateMany({ where: { id: row.id, revision: input.expectedRevision }, data: { revision: { increment: 1 } } });
    if (!claimed.count) { const raced = await duplicate(); if (raced) return replay(raced); return { status: "CONFLICT" as const, progress: dto(await tx.endgameProgress.findUniqueOrThrow({ where: { id: row.id } })) }; }
    const next = applyEndgameSnapshot(position, dto(row), input.snapshot);
    await tx.endgameProgress.update({ where: { id: row.id }, data: { revision: next.revision, snapshot: next.snapshot!, attempts: next.attempts, completedAt: next.completedAt ? new Date(next.completedAt) : null, completionAssisted: next.completionAssisted } });
    await tx.endgameAction.create({ data: { progressId: row.id, ...input } });
    return { status: "OK" as const, progress: next };
  });
}
