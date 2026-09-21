import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";

const db = createTestDb();
const ownedIds: string[] = [];
const parsed = parsePgn(readFileSync(new URL("../fixtures/pgn/complete.pgn", import.meta.url), "utf8"));

async function storeFixture(userColor: "WHITE" | "BLACK" = "WHITE") {
  const id = randomUUID();
  ownedIds.push(id);
  return db.game.create({
    data: {
      id, pgn: parsed.pgn, initialFen: parsed.initialFen, ...parsed.metadata,
      playedAt: parsed.metadata.playedAt ? new Date(parsed.metadata.playedAt) : null,
      userColor,
      moves: { create: parsed.moves },
    },
  });
}

beforeAll(async () => { await assertTestDatabase(db); });
afterEach(async () => {
  await assertTestDatabase(db);
  // Delete only records created by this process, never truncate shared tables.
  await db.game.deleteMany({ where: { id: { in: ownedIds } } });
  ownedIds.length = 0;
});
afterAll(async () => { await db.$disconnect(); });

describe("Game and GameMove persistence", () => {
  it.each(["WHITE", "BLACK"] as const)("round-trips a parsed fixture for %s", async (color) => {
    const created = await storeFixture(color);
    const stored = await db.game.findUniqueOrThrow({ where: { id: created.id }, include: { moves: { orderBy: { ply: "asc" } } } });
    expect(stored).toMatchObject({ ...parsed.metadata, playedAt: new Date(parsed.metadata.playedAt!),
      pgn: parsed.pgn, initialFen: parsed.initialFen, userColor: color,
      analysisStatus: "PENDING", analysisError: null,
    });
    expect(stored.createdAt).toBeInstanceOf(Date);
    expect(stored.updatedAt).toBeInstanceOf(Date);
    expect(stored.moves).toEqual(parsed.moves.map((move) => ({ ...move, id: expect.any(String), gameId: created.id })));
  });

  it("rejects duplicate plies within a game but permits them in another game", async () => {
    const first = await storeFixture();
    await expect(db.gameMove.create({ data: { ...parsed.moves[0], gameId: first.id } })).rejects.toMatchObject({ code: "P2002" });
    const second = await storeFixture();
    expect(await db.gameMove.count({ where: { gameId: second.id, ply: 1 } })).toBe(1);
  });

  it("rejects orphan moves", async () => {
    await expect(db.gameMove.create({ data: { ...parsed.moves[0], gameId: randomUUID() } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects invalid and missing user colors at the database boundary", async () => {
    const game = await storeFixture();
    await expect(db.$executeRaw`UPDATE "Game" SET "userColor" = 'RED' WHERE id = ${game.id}`).rejects.toThrow();
    await expect(db.$executeRaw`UPDATE "Game" SET "userColor" = NULL WHERE id = ${game.id}`).rejects.toThrow();
    expect((await db.game.findUniqueOrThrow({ where: { id: game.id } })).userColor).toBe("WHITE");
  });

  it("rejects invalid move colors", async () => {
    const game = await storeFixture();
    await expect(db.$executeRaw`UPDATE "GameMove" SET color = 'RED' WHERE "gameId" = ${game.id}`).rejects.toThrow();
  });

  it("stores status/error updates and cascades game deletion to its moves", async () => {
    const game = await storeFixture();
    const updated = await db.game.update({ where: { id: game.id }, data: { analysisStatus: "FAILED", analysisError: "Engine unavailable" } });
    expect(updated.analysisError).toBe("Engine unavailable");
    expect(updated.analysisStatus).toBe("FAILED");
    await db.game.delete({ where: { id: game.id } });
    expect(await db.gameMove.count({ where: { gameId: game.id } })).toBe(0);
  });
});
