import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { listGames, findGame } from "@/lib/games/queries";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
const ids: string[] = [randomUUID(), randomUUID()];
const game = parsePgn('[White "Library player"]\n[Date "2026.01.02"]\n\n1. e4 e5 *');
beforeAll(async () => {
  await assertTestDatabase(db);
  for (const [index, id] of ids.entries()) await db.game.create({ data: {
    id, pgn: game.pgn, initialFen: game.initialFen, ...game.metadata,
    playedAt: new Date(game.metadata.playedAt!), userColor: index ? "BLACK" : "WHITE",
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`),
    moves: { create: [...game.moves].reverse() },
  } });
});
afterAll(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
it("lists newest first with serializable summaries only", async () => {
  const saved = (await listGames(db)).filter(item => ids.includes(item.id));
  expect(saved.map(item => item.id)).toEqual([...ids].reverse());
  expect(saved[0]).toMatchObject({ status: "PENDING", userColor: "BLACK", playedAt: "2026-01-02T00:00:00.000Z" });
  expect(saved[0]).not.toHaveProperty("pgn");
  expect(saved[0]).not.toHaveProperty("moves");
});
it.each([0, 1])("restores saved orientation and ordered replay (%#)", async (index) => {
  const saved = await findGame(db, ids[index]);
  expect(saved?.userColor).toBe(index ? "BLACK" : "WHITE");
  expect(saved?.game).toEqual({ initialFen: game.initialFen, metadata: game.metadata, moves: game.moves });
  expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
});
it("returns null for missing IDs", async () => {
  expect(await findGame(db, randomUUID())).toBeNull();
});
