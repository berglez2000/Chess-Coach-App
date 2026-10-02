import type { PrismaClient, PuzzleProgress } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import type { PuzzleAction, PuzzleState } from "@/types/puzzle";
import { applyPuzzleAction, INITIAL_PROGRESS, solverDto } from "./solve";

const owned = (ownerId: string) => ({ generation: { status: "COMPLETED", game: { ownerId: requireOwnerId(ownerId) } } });
function state(row?: PuzzleProgress | null): PuzzleState {
  if (!row) return { ...INITIAL_PROGRESS };
  return { revision: row.revision, state: row.state as PuzzleState["state"], assisted: row.assisted,
    hintUsed: row.hintUsed, solvedMove: row.solvedMove, playedMoves: row.playedMoves, lastOutcome: row.lastOutcome, moveAttempts: row.moveAttempts,
    completedAt: row.completedAt?.toISOString() ?? null, completionAssisted: row.completionAssisted };
}
export async function findPracticePuzzle(db: PrismaClient, id: string, userId: string) {
  const puzzle = await db.personalPuzzle.findFirst({ where: { id, ...owned(userId) },
    include: { generation: { select: { gameId: true } }, progress: { where: { userId } } } });
  return puzzle ? solverDto(puzzle, state(puzzle.progress[0])) : null;
}
export async function listPracticePuzzles(db: PrismaClient, userId: string, gameId?: string, page = 1) {
  const where = { ...owned(userId), ...(gameId ? { generation: { status: "COMPLETED", gameId, game: { ownerId: userId } } } : {}) };
  const [count, rows] = await Promise.all([
    db.personalPuzzle.count({ where }),
    db.personalPuzzle.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 24, take: 24,
      select: { id: true, sourcePly: true, playerColor: true, generation: { select: { gameId: true, version: true, game: { select: { whiteName: true, blackName: true } } } },
        progress: { where: { userId }, select: { completedAt: true, completionAssisted: true, moveAttempts: true, state: true } } } }),
  ]);
  return { count, rows };
}
export async function nextPracticePuzzle(db: PrismaClient, id: string, userId: string) {
  const current = await db.personalPuzzle.findFirst({ where: { id, ...owned(userId) }, select: { generationId: true } });
  if (!current) return null;
  const siblings = await db.personalPuzzle.findMany({ where: { generationId: current.generationId, ...owned(userId) },
    orderBy: [{ sourcePly: "asc" }, { id: "asc" }], select: { id: true } });
  const index = siblings.findIndex(puzzle => puzzle.id === id);
  return siblings[index + 1]?.id ?? null;
}

export async function actOnPuzzle(db: PrismaClient, id: string, userId: string, action: PuzzleAction) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    const puzzle = await tx.personalPuzzle.findFirst({ where: { id, ...owned(userId) }, include: { generation: { select: { gameId: true } } } });
    if (!puzzle) return { status: "NOT_FOUND" as const };
    await tx.puzzleProgress.createMany({ data: [{ puzzleId: id, userId }], skipDuplicates: true });
    const row = await tx.puzzleProgress.findUniqueOrThrow({ where: { puzzleId_userId: { puzzleId: id, userId } } });
    const duplicate = async () => tx.puzzleAttempt.findUnique({ where: { progressId_requestId: { progressId: row.id, requestId: action.requestId } } });
    const replay = async (attempt: NonNullable<Awaited<ReturnType<typeof duplicate>>>) => {
      const current = await tx.puzzleProgress.findUniqueOrThrow({ where: { id: row.id } });
      const same = attempt.action === action.action && attempt.expectedRevision === action.expectedRevision && attempt.move === (action.action === "MOVE" ? action.move : null);
      return { status: same ? "OK" as const : "CONFLICT" as const, puzzle: solverDto(puzzle, state(current)) };
    };
    const existing = await duplicate();
    if (existing) return replay(existing);
    // This conditional update acquires the row lock and serializes tabs/retries.
    const claimed = await tx.puzzleProgress.updateMany({ where: { id: row.id, userId, revision: action.expectedRevision }, data: { revision: { increment: 1 } } });
    if (!claimed.count) {
      const raced = await duplicate();
      if (raced) return replay(raced);
      const current = await tx.puzzleProgress.findUniqueOrThrow({ where: { id: row.id } });
      return { status: "CONFLICT" as const, puzzle: solverDto(puzzle, state(current)) };
    }
    const locked = await tx.puzzleProgress.findUniqueOrThrow({ where: { id: row.id } });
    const next = applyPuzzleAction(puzzle, { ...state(locked), revision: action.expectedRevision }, action);
    await tx.puzzleProgress.update({ where: { id: row.id }, data: { ...next, completedAt: next.completedAt ? new Date(next.completedAt) : null } });
    await tx.puzzleAttempt.create({ data: { progressId: row.id, requestId: action.requestId, expectedRevision: action.expectedRevision,
      action: action.action, move: action.action === "MOVE" ? action.move : null, outcome: next.lastOutcome!, assisted: next.assisted } });
    return { status: "OK" as const, puzzle: solverDto(puzzle, next) };
  });
}
