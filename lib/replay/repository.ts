import { isDeepStrictEqual } from "node:util";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { requireOwnerId } from "@/lib/auth/owner";
import { applyPuzzleAction, INITIAL_PROGRESS, solverDto, puzzleActionSchema, type PuzzleDefinition } from "@/lib/puzzles/solve";
import { replay } from "@/lib/puzzles/sequence";
import type { PuzzleState } from "@/types/puzzle";
import { replayOutcome, type ReplayAction, type ReplayComparison, type ReplayDto } from "./contract";

type Db = PrismaClient | Prisma.TransactionClient;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const include = { challenges: { orderBy: { order: "asc" as const } } };
async function load(db: Db, id: string, userId: string) {
  return db.replaySession.findFirst({ where: { id, userId: requireOwnerId(userId) }, include });
}
type Session = NonNullable<Awaited<ReturnType<typeof load>>>;
function dto(session: Session): ReplayDto {
  const current = session.challenges.find(row => row.order >= session.currentIndex);
  const completed = !!session.completedAt || !current;
  const results = { firstTry: 0, retried: 0, assisted: 0, revealed: 0, skipped: 0 };
  for (const row of session.challenges) {
    const outcome = replayOutcome(row.progress as unknown as PuzzleState, row.mistakes, row.skipped);
    if (outcome) results[outcome]++;
  }
  const progress = current?.progress as unknown as PuzzleState | undefined;
  const definition = current?.definition as unknown as PuzzleDefinition | undefined;
  const exposed = progress && progress.state !== "SOLVING" && !current!.skipped;
  const puzzle = !completed && progress && definition ? solverDto(definition, { ...progress, revision: session.revision }) : null;
  // Source references can expose the recorded answer through a separate review endpoint.
  if (puzzle) puzzle.id = current!.id;
  if (puzzle && !exposed) { puzzle.gameId = ""; puzzle.sourcePly = 0; }
  return { id: session.id, revision: session.revision, index: current ? session.challenges.indexOf(current) : session.challenges.length,
    total: session.challenges.length, completed, restartGameId: completed ? session.scopeGameId : null, puzzle,
    comparison: exposed ? { ...(current!.comparison as unknown as Omit<ReplayComparison, "firstAttempt">),
      firstAttempt: current!.firstMove ? replay(definition!.startingFen, [current!.firstMove]).history[0] : null } : null,
    mistakes: current?.mistakes ?? 0, results };
}
export async function findReplay(db: Db, id: string, userId: string) {
  const session = await load(db, id, userId);
  return session ? dto(session) : null;
}
export async function replayLibrary(db: PrismaClient, userId: string, gameId?: string) {
  requireOwnerId(userId);
  const [count, sessions] = await Promise.all([
    db.personalPuzzle.count({ where: { generation: { status: "COMPLETED", game: { ownerId: userId }, ...(gameId ? { gameId } : {}) } } }),
    db.replaySession.findMany({ where: { userId, ...(gameId ? { scopeGameId: gameId } : {}), challenges: { some: {} } }, orderBy: { createdAt: "desc" }, take: 10, include }),
  ]);
  return { count, sessions: sessions.map(dto) };
}
export async function startReplay(db: PrismaClient, userId: string, requestId: string, gameId?: string) {
  requireOwnerId(userId);
  // Serialize starts for this owner, including concurrent double clicks and retries.
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const previous = await tx.replaySession.findUnique({ where: { userId_requestId: { userId, requestId } }, include });
    if (previous) return previous.scopeGameId === (gameId ?? null) ? dto(previous) : null;
    if (gameId && !await tx.game.findFirst({ where: { id: gameId, ownerId: userId } })) return null;
    const active = await tx.replaySession.findFirst({ where: { userId, scopeGameId: gameId ?? null, completedAt: null, challenges: { some: {} } }, orderBy: { createdAt: "desc" }, include });
    if (active && !dto(active).completed) return dto(active);
    if (active) await tx.replaySession.update({ where: { id: active.id }, data: { completedAt: new Date() } });
    const rows = await tx.personalPuzzle.findMany({ where: { generation: { status: "COMPLETED", game: { ownerId: userId }, ...(gameId ? { gameId } : {}) } },
      include: { generation: { select: { gameId: true, version: true, game: { select: { moves: { select: { ply: true, uci: true, san: true, fenAfter: true, coachingAnnotation: { select: { explanation: true, lesson: true } } } } } } } }, progress: { where: { userId } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    const attempts = await tx.replayChallenge.findMany({ where: { session: { userId } }, orderBy: { session: { createdAt: "asc" } }, select: { puzzleId: true, progress: true, skipped: true } });
    const rank = (row: typeof rows[number]) => {
      const history = attempts.filter(attempt => attempt.puzzleId === row.id);
      if (!history.length && !row.progress.length) return 0;
      const latest = history.at(-1)?.progress as unknown as PuzzleState | undefined;
      const saved = row.progress[0];
      return latest ? latest.state === "SOLVED" && !latest.assisted ? 2 : 1 : saved?.completedAt && !saved.completionAssisted ? 2 : 1;
    };
    const seen = new Set<string>();
    const selected = rows.sort((a, b) => rank(a) - rank(b)).filter(row => {
      if (seen.has(row.startingFen)) return false;
      seen.add(row.startingFen); return true;
    }).slice(0, 5);
    if (!selected.length) return null;
    const session = await tx.replaySession.create({ data: { userId, requestId, scopeGameId: gameId ?? null, challenges: { create: selected.map((row, order) => {
      const move = row.generation.game.moves.find(move => move.ply === row.sourcePly);
      if (!move) throw new Error("Source position unavailable.");
      return { gameId: row.generation.gameId, puzzleId: row.id, order,
        definition: json({ id: row.id, startingFen: row.startingFen, playerColor: row.playerColor, sourcePly: row.sourcePly,
          acceptedMoves: row.acceptedMoves, solution: row.solution, sourceRunId: row.sourceRunId, policyVersion: row.generation.version, generation: { gameId: row.generation.gameId } }),
        comparison: json({ original: { uci: move.uci, san: move.san, fen: move.fenAfter }, explanation: move.coachingAnnotation?.explanation ?? null,
          lesson: move.coachingAnnotation?.lesson ?? null, gameId: row.generation.gameId, sourcePly: row.sourcePly }),
        progress: json(INITIAL_PROGRESS) };
    }) } }, include });
    return dto(session);
  });
}
export async function actOnReplay(db: PrismaClient, id: string, userId: string, action: ReplayAction) {
  requireOwnerId(userId);
  return db.$transaction(async tx => {
    // A row lock protects the action log and challenge state as one transaction.
    await tx.$queryRaw`SELECT id FROM "ReplaySession" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const session = await load(tx, id, userId);
    if (!session) return { status: "NOT_FOUND" as const };
    const existing = await tx.replayAction.findUnique({ where: { sessionId_requestId: { sessionId: id, requestId: action.requestId } } });
    if (existing) return { status: isDeepStrictEqual(existing.payload, json(action)) ? "OK" as const : "CONFLICT" as const, session: dto(session) };
    if (session.revision !== action.expectedRevision) return { status: "CONFLICT" as const, session: dto(session) };
    const current = session.challenges.find(row => row.order >= session.currentIndex);
    if (!current || session.completedAt) return { status: "OK" as const, session: dto(session) };
    const progress = current.progress as unknown as PuzzleState;
    if (action.action === "NEXT" || action.action === "SKIP") {
      if (action.action === "NEXT" && progress.state === "SOLVING") return { status: "CONFLICT" as const, session: dto(session) };
      if (action.action === "SKIP" && progress.state === "SOLVING") await tx.replayChallenge.update({ where: { id: current.id }, data: { skipped: true } });
      const next = session.challenges.find(row => row.order > current.order);
      await tx.replaySession.update({ where: { id }, data: { currentIndex: next?.order ?? current.order + 1, completedAt: next ? null : new Date() } });
    } else {
      // Finished challenges remain finished. A new session provides a fresh attempt.
      if (progress.state !== "SOLVING") return { status: "CONFLICT" as const, session: dto(session) };
      const definition = current.definition as unknown as PuzzleDefinition;
      const next = applyPuzzleAction(definition, progress, puzzleActionSchema.parse(action));
      if (next.lastOutcome === "ILLEGAL") next.moveAttempts = progress.moveAttempts;
      const legal = action.action === "MOVE" && next.lastOutcome !== "ILLEGAL";
      await tx.replayChallenge.update({ where: { id: current.id }, data: { progress: json(next),
        ...(legal && !current.firstMove ? { firstMove: action.move } : {}),
        ...(next.lastOutcome === "INCORRECT" ? { mistakes: { increment: 1 } } : {}) } });
    }
    await tx.replayAction.create({ data: { sessionId: id, challengeId: current.id, requestId: action.requestId, payload: json(action) } });
    await tx.replaySession.update({ where: { id }, data: { revision: { increment: 1 } } });
    return { status: "OK" as const, session: dto((await load(tx, id, userId))!) };
  });
}
