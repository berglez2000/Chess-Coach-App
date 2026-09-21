import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { importGame } from "@/lib/games/import-game";
import { createImportRepository } from "@/lib/games/import-repository";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";

const db = createTestDb();
const repository = createImportRepository(db);
const pgns: string[] = [];
function uniquePgn() {
  const pgn = `[Event "import-test-${randomUUID()}"]\n\n1. e4 e5 2. Nf3 *`;
  pgns.push(pgn);
  return pgn;
}
beforeAll(async () => { await assertTestDatabase(db); });
afterEach(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { pgn: { in: pgns } } });
  pgns.length = 0;
});
afterAll(async () => { await db.$disconnect(); });
it.each(["WHITE", "BLACK"] as const)("persists a complete %s import and allows identical PGNs", async (userColor) => {
  const pgn = uniquePgn();
  const result = await importGame({ userColor, pgn }, repository);
  expect(result).toMatchObject({ status: "PENDING" });
  if ("error" in result) throw new Error("Import failed");
  const game = await db.game.findUniqueOrThrow({ where: { id: result.gameId }, include: { moves: { orderBy: { ply: "asc" } } } });
  expect(game).toMatchObject({ pgn, userColor, analysisStatus: "PENDING", initialFen: parsePgn(pgn).initialFen });
  expect(game.moves).toEqual(parsePgn(pgn).moves.map(move => ({ ...move, id: expect.any(String), gameId: game.id })));
  expect(await importGame({ userColor, pgn }, repository)).toMatchObject({ status: "PENDING" });
  expect(await db.game.count({ where: { pgn } })).toBe(2);
});
it("invalid color and illegal PGN create no rows", async () => {
  const pgn = uniquePgn();
  const illegal = `${pgn.replace("2. Nf3 *", "2. Bh6 *")}`;
  pgns.push(illegal);
  expect(await importGame({ userColor: "RED", pgn }, repository)).toHaveProperty("error.code", "INVALID_INPUT");
  expect(await importGame({ userColor: "WHITE", pgn: illegal }, repository)).toHaveProperty("error.code", "ILLEGAL_MOVE");
  expect(await db.game.count({ where: { pgn: { in: pgns } } })).toBe(0);
});
it("rolls back the parent and moves when a nested move violates a real database constraint", async () => {
  const pgn = uniquePgn();
  const result = await importGame({ userColor: "WHITE", pgn }, {
    create: (game, color) => repository.create({ ...game, moves: [...game.moves, game.moves[0]] }, color),
  });
  expect(result).toHaveProperty("error.code", "IMPORT_FAILED");
  expect(await db.game.count({ where: { pgn } })).toBe(0);
  expect(await db.gameMove.count({ where: { game: { pgn } } })).toBe(0);
  // The same input can be retried successfully after the failure.
  expect(await importGame({ userColor: "WHITE", pgn }, repository)).toHaveProperty("status", "PENDING");
});
