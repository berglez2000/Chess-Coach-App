import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createTestDb, assertTestDatabase } from "../support/database";
import { createTestOwner } from "../support/test-owner";
import { parsePgn } from "@/lib/pgn/parse";
import { createImportRepository } from "@/lib/games/import-repository";
import { actOnReplay, findReplay, startReplay } from "@/lib/replay/repository";
import type { ReplayAction, ReplayDto } from "@/lib/replay/contract";
const db = createTestDb();
const owners: string[] = []; const games: string[] = [];
beforeAll(async () => { await assertTestDatabase(db); owners.push(await createTestOwner(db), await createTestOwner(db)); });
afterEach(async () => { await db.game.deleteMany({ where: { id: { in: games } } }); await db.replaySession.deleteMany({ where: { userId: { in: owners } } }); games.length = 0; });
afterAll(async () => { await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });
async function fixture(sequence = false) {
  const parsed = parsePgn("1. Nf3 e5 2. d4 *");
  const game = await createImportRepository(db, owners[0]).create(parsed, "WHITE"); games.push(game.id);
  const generation = await db.puzzleGeneration.create({ data: { gameId: game.id, version: 2, status: "COMPLETED", configuration: {}, puzzles: { create: {
    sourcePly: 1, sourceRunId: "test-run", startingFen: parsed.initialFen, playerColor: "WHITE", acceptedMoves: ["e2e4"], validation: {},
    ...(sequence ? { solution: { version: 1, maxPlayerMoves: 3, lines: [{ moves: ["e2e4", "e7e5", "g1f3"], goal: "validated-boundary" }] } } : {}),
  } } }, include: { puzzles: true } });
  return { gameId: game.id, puzzleId: generation.puzzles[0].id };
}
async function act(session: ReplayDto, action: ReplayAction["action"], move?: string) {
  const result = await actOnReplay(db, session.id, owners[0], { action, ...(move ? { move } : {}), requestId: randomUUID(), expectedRevision: session.revision } as ReplayAction);
  if (result.status !== "OK") throw new Error(result.status);
  return result.session;
}
it("hides answers and source references, ignores illegal attempts, and preserves original first attempt through retry", async () => {
  const fixtureData = await fixture(); let session = (await startReplay(db, owners[0], randomUUID(), fixtureData.gameId))!;
  expect(session.comparison).toBeNull(); expect(session.puzzle).toMatchObject({ solutionLine: null, gameId: "", sourcePly: 0 });
  expect(JSON.stringify(session)).not.toContain(fixtureData.puzzleId);
  session = await act(session, "MOVE", "e2e5"); expect(session.puzzle!.progress.moveAttempts).toBe(0);
  session = await act(session, "MOVE", "d2d4"); expect(session.mistakes).toBe(1);
  session = await act(session, "RETRY"); session = await act(session, "MOVE", "e2e4");
  expect(session.comparison).toMatchObject({ original: { san: "Nf3" }, firstAttempt: { san: "d4" }, gameId: fixtureData.gameId });
  expect(session.results).toMatchObject({ firstTry: 0, retried: 1 });
  expect(await findReplay(db, session.id, owners[0])).toEqual(session);
  session = await act(session, "NEXT"); expect(session.completed).toBe(true);
  expect(await db.puzzleProgress.count({ where: { puzzleId: fixtureData.puzzleId } })).toBe(0);
  const fresh = (await startReplay(db, owners[0], randomUUID(), fixtureData.gameId))!;
  expect(fresh.id).not.toBe(session.id); expect(fresh.puzzle!.progress.moveAttempts).toBe(0);
});
it("requires the complete sequence and separates hint, reveal and skip outcomes", async () => {
  const { gameId } = await fixture(true); let session = (await startReplay(db, owners[0], randomUUID(), gameId))!;
  session = await act(session, "MOVE", "e2e4"); expect(session.puzzle!.history).toHaveLength(2); expect(session.comparison).toBeNull();
  expect((await actOnReplay(db, session.id, owners[0], { action: "NEXT", expectedRevision: session.revision, requestId: randomUUID() })).status).toBe("CONFLICT");
  session = await act(session, "HINT"); session = await act(session, "MOVE", "g1f3"); expect(session.results.assisted).toBe(1);
  session = await act(session, "NEXT"); session = (await startReplay(db, owners[0], randomUUID(), gameId))!;
  session = await act(session, "REVEAL"); expect(session.results.revealed).toBe(1); expect(session.comparison!.firstAttempt).toBeNull();
  session = await act(session, "NEXT"); session = (await startReplay(db, owners[0], randomUUID(), gameId))!;
  session = await act(session, "SKIP"); expect(session.completed).toBe(true); expect(session.results.skipped).toBe(1);
});
it("serializes starts and actions, fences stale writes, and denies other owners", async () => {
  const { gameId } = await fixture(); const requestId = randomUUID();
  const starts = await Promise.all([startReplay(db, owners[0], requestId, gameId), startReplay(db, owners[0], requestId, gameId)]);
  const session = starts[0]!; expect(starts[1]!.id).toBe(session.id);
  const action = { action: "MOVE" as const, move: "e2e4", expectedRevision: 0, requestId: randomUUID() };
  const writes = await Promise.all([actOnReplay(db, session.id, owners[0], action), actOnReplay(db, session.id, owners[0], action)]);
  expect(writes.map(row => row.status)).toEqual(["OK", "OK"]);
  expect((await findReplay(db, session.id, owners[0]))!.revision).toBe(1);
  expect((await actOnReplay(db, session.id, owners[0], { ...action, move: "d2d4" })).status).toBe("CONFLICT");
  expect((await actOnReplay(db, session.id, owners[0], { ...action, requestId: randomUUID() })).status).toBe("CONFLICT");
  expect(await findReplay(db, session.id, owners[1])).toBeNull();
  expect((await actOnReplay(db, session.id, owners[1], action)).status).toBe("NOT_FOUND");
  expect(await startReplay(db, owners[1], randomUUID(), gameId)).toBeNull();
});
it("snapshots solution/coaching and removes private snapshots with the source game", async () => {
  const { gameId, puzzleId } = await fixture(); const session = (await startReplay(db, owners[0], randomUUID(), gameId))!;
  await db.personalPuzzle.update({ where: { id: puzzleId }, data: { acceptedMoves: ["d2d4"] } });
  const solved = await act(session, "MOVE", "e2e4"); expect(solved.results.firstTry).toBe(1);
  await db.game.delete({ where: { id: gameId } });
  expect(await db.replayChallenge.count({ where: { sessionId: session.id } })).toBe(0);
  expect(await db.replayAction.count({ where: { sessionId: session.id } })).toBe(0);
  expect((await findReplay(db, session.id, owners[0]))!.puzzle).toBeNull();
});
it("starts no session when no eligible puzzles exist", async () => {
  expect(await startReplay(db, owners[0], randomUUID())).toBeNull();
});
it("prioritizes unseen challenges, limits sessions to five, and avoids duplicate positions", async () => {
  const parsed = parsePgn("1. Nf3 e5 2. d4 d5 3. e3 Nc6 4. Bb5 a6 5. Bxc6 bxc6 6. O-O Nf6 *");
  const { id: gameId } = await createImportRepository(db, owners[0]).create(parsed, "WHITE"); games.push(gameId);
  const generation = await db.puzzleGeneration.create({ data: { gameId, version: 2, status: "COMPLETED", configuration: {}, puzzles: { create: parsed.moves.filter(move => move.color === "WHITE").map(move => ({ sourcePly: move.ply, sourceRunId: "fixture", startingFen: move.fenBefore, playerColor: "WHITE", acceptedMoves: [move.uci], validation: {} })) } }, include: { puzzles: { orderBy: { sourcePly: "asc" } } } });
  // These fixture solutions exercise selection/state storage, not engine quality.
  const solved = generation.puzzles[0]; const assisted = generation.puzzles[1];
  await db.puzzleProgress.createMany({ data: [{ userId: owners[0], puzzleId: solved.id, state: "SOLVED", completedAt: new Date(), completionAssisted: false }, { userId: owners[0], puzzleId: assisted.id, state: "SOLVED", completedAt: new Date(), completionAssisted: true }] });
  const { gameId: duplicateGame } = await fixture();
  // fixture() starts from the same standard position as the solved puzzle.
  await db.puzzleProgress.create({ data: { userId: owners[0], puzzleId: generation.puzzles[2].id, state: "SOLVED", completedAt: new Date(), completionAssisted: false } });
  const session = (await startReplay(db, owners[0], randomUUID()))!; expect(session.total).toBe(5);
  const rows = await db.replayChallenge.findMany({ where: { sessionId: session.id }, orderBy: { order: "asc" } });
  expect(rows[0].puzzleId).not.toBe(assisted.id);
  expect(new Set(rows.map(row => (row.definition as { startingFen: string }).startingFen)).size).toBe(5);
  expect(rows.some(row => row.gameId === duplicateGame)).toBe(true);
  expect(rows.some(row => row.puzzleId === solved.id)).toBe(false);
  expect(rows.at(-1)!.puzzleId).toBe(assisted.id);
});
it("grades explicit underpromotion and does not expose a solution on an illegal promotion attempt", async () => {
  const parsed = parsePgn('[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. a8=Q+ *');
  const { id: gameId } = await createImportRepository(db, owners[0]).create(parsed, "WHITE"); games.push(gameId);
  await db.puzzleGeneration.create({ data: { gameId, version: 2, status: "COMPLETED", configuration: {}, puzzles: { create: { sourcePly: 1, sourceRunId: "fixture", startingFen: parsed.initialFen, playerColor: "WHITE", acceptedMoves: ["a7a8n"], validation: {} } } } });
  let session = (await startReplay(db, owners[0], randomUUID(), gameId))!;
  session = await act(session, "MOVE", "a7b8n"); expect(session.puzzle!.progress.moveAttempts).toBe(0); expect(session.comparison).toBeNull();
  session = await act(session, "MOVE", "a7a8n"); expect(session.results.firstTry).toBe(1); expect(session.comparison!.firstAttempt!.san).toBe("a8=N");
});
