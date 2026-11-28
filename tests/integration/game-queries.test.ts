import { createTestOwner } from "../support/test-owner";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { listGames, findGame } from "@/lib/games/queries";
import { saveNote } from "@/lib/games/notes";
import { parsePgn } from "@/lib/pgn/parse";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
let ownerId: string;
const ids: string[] = [randomUUID(), randomUUID()];
const game = parsePgn('[White "Library player"]\n[Date "2026.01.02"]\n\n1. e4 e5 *');
beforeAll(async () => {
  await assertTestDatabase(db);
  ownerId = await createTestOwner(db);
  for (const [index, id] of ids.entries()) await db.game.create({ data: {
    id, ownerId, pgn: game.pgn, initialFen: game.initialFen, ...game.metadata,
    playedAt: new Date(game.metadata.playedAt!), userColor: index ? "BLACK" : "WHITE",
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`),
    moves: { create: [...game.moves].reverse() },
  } });
});
afterAll(async () => {
  await assertTestDatabase(db);
  await db.game.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});
it("lists newest first with serializable summaries only", async () => {
  const saved = (await listGames(db, ownerId)).filter(item => ids.includes(item.id));
  expect(saved.map(item => item.id)).toEqual([...ids].reverse());
  expect(saved[0]).toMatchObject({ status: "PENDING", userColor: "BLACK", playedAt: "2026-01-02T00:00:00.000Z" });
  expect(saved[0]).not.toHaveProperty("pgn");
  expect(saved[0]).not.toHaveProperty("moves");
});
it.each([0, 1])("restores saved orientation and ordered replay (%#)", async (index) => {
  const saved = await findGame(db, ids[index], ownerId);
  expect(saved?.userColor).toBe(index ? "BLACK" : "WHITE");
  expect(saved?.game).toEqual({ initialFen: game.initialFen, metadata: game.metadata, coaching: null, details: {}, moves: game.moves.map(move => ({ ...move, analysis: null, coaching: null })) });
  expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
});
it("returns null for missing IDs", async () => {
  expect(await findGame(db, randomUUID(), ownerId)).toBeNull();
});
it("saves, trims and clears the owner's notes on a game and its moves", async () => {
  const [id, other] = ids;
  expect(await saveNote(db, id, ownerId, null, "  Rushed the opening \n")).toBe("Rushed the opening");
  expect(await saveNote(db, id, ownerId, 2, "Mirror reply")).toBe("Mirror reply");
  const saved = await findGame(db, id, ownerId);
  expect(saved?.game.note).toBe("Rushed the opening");
  expect(saved?.game.moves.map(move => move.note)).toEqual([undefined, "Mirror reply"]);
  expect((await findGame(db, other, ownerId))?.game).not.toHaveProperty("note");

  // A missing move, a missing game, and another user's game are not written.
  const stranger = await createTestOwner(db);
  try {
    expect(await saveNote(db, id, ownerId, 3, "No such move")).toBeUndefined();
    expect(await saveNote(db, randomUUID(), ownerId, null, "No such game")).toBeUndefined();
    expect(await saveNote(db, id, stranger, null, "Not mine")).toBeUndefined();
    expect(await saveNote(db, id, stranger, 2, "Not mine")).toBeUndefined();
  } finally { await db.user.deleteMany({ where: { id: stranger } }); }

  expect(await saveNote(db, id, ownerId, null, "   ")).toBeNull();
  expect(await saveNote(db, id, ownerId, 2, "")).toBeNull();
  const cleared = await findGame(db, id, ownerId);
  expect(cleared?.game).not.toHaveProperty("note");
  expect(cleared?.game.moves.some(move => "note" in move)).toBe(false);
});
