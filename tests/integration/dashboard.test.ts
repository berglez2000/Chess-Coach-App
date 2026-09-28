import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getDashboard } from "@/lib/games/queries";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";

const db = createTestDb();
const ids: string[] = [];
beforeAll(async () => { await assertTestDatabase(db); });
afterAll(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
it("counts all games but returns only the five newest lightweight summaries", async () => {
  const before = await db.game.count();
  const game = parsePgn("1. e4 e5 *");
  for (let index = 0; index < 7; index++) {
    const id = randomUUID();
    ids.push(id);
    await db.game.create({ data: {
      id, pgn: game.pgn, initialFen: game.initialFen, result: "*", userColor: "WHITE",
      createdAt: new Date(`2099-01-0${index + 1}T00:00:00Z`),
    } });
  }
  const dashboard = await getDashboard(db);
  expect(dashboard.count).toBe(before + 7);
  expect(dashboard.recentGames.map(game => game.id)).toEqual(ids.slice(2).reverse());
  expect(dashboard.recentGames[0]).toMatchObject({ status: "PENDING", playedAt: null, userColor: "WHITE" });
  expect(dashboard.recentGames[0]).not.toHaveProperty("pgn");
  expect(dashboard.recentGames[0]).not.toHaveProperty("moves");
  expect(JSON.parse(JSON.stringify(dashboard))).toEqual(dashboard);
});
