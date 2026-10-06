import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { assertTestDatabase, createTestDb } from "../support/database";
import { createTestOwner } from "../support/test-owner";
import { openingRepository } from "@/lib/openings/repository";
import { EMPTY_OPENING } from "@/lib/openings/content";
vi.mock("server-only", () => ({}));
const db = createTestDb(); const owners: string[] = [];
beforeAll(async () => { await assertTestDatabase(db); owners.push(await createTestOwner(db), await createTestOwner(db)); });
afterAll(async () => { await assertTestDatabase(db); await db.game.deleteMany({ where: { ownerId: { in: owners } } }); await db.user.deleteMany({ where: { id: { in: owners } } }); await db.$disconnect(); });
const repertoire = { ...EMPTY_OPENING, name: "Queens pawn", lines: [{ name: "Main", moves: ["g1f3", "d7d5", "d2d4", "g8f6"] }] };
it("persists private openings, rejects cross-owner reads/writes, and guards concurrent edits", async () => {
  const a = openingRepository(db, owners[0]); const b = openingRepository(db, owners[1]);
  const opening = await a.create(repertoire);
  expect((await a.list()).some(x => x.id === opening.id)).toBe(true);
  expect(await b.list()).toEqual([]);
  await expect(b.get(opening.id)).rejects.toMatchObject({ status: 404 });
  await expect(b.update(opening.id, 0, { ...repertoire, name: "Stolen" })).rejects.toMatchObject({ status: 404 });
  const results = await Promise.allSettled([a.update(opening.id, 0, { ...repertoire, name: "A" }), a.update(opening.id, 0, { ...repertoire, name: "B" })]);
  expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
  expect(results.find(x => x.status === "rejected")).toMatchObject({ reason: { status: 409 } });
  expect((await a.get(opening.id)).revision).toBe(1);
});
async function game(ownerId: string, sans: string[]) {
  const chess = new Chess(); const moves = sans.map((san, i) => { const move = chess.move(san); return { ply: i + 1, moveNumber: Number(move.before.split(" ")[5]), color: move.color === "w" ? "WHITE" as const : "BLACK" as const, san: move.san, uci: move.lan, fenBefore: move.before, fenAfter: move.after }; });
  return db.game.create({ data: { ownerId, initialFen: DEFAULT_POSITION, pgn: chess.pgn(), userColor: "WHITE", result: "*", moves: { create: moves } } });
}
it("finds transposed owned games and excludes unrelated or other users' games", async () => {
  const repo = openingRepository(db, owners[0]); const opening = await repo.create(repertoire);
  const matched = await game(owners[0], ["d4", "Nf6", "Nf3", "d5"]);
  const unrelated = await game(owners[0], ["e4", "e5", "Nf3", "Nc6"]);
  const foreign = await game(owners[1], ["d4", "Nf6", "Nf3", "d5"]);
  const results = await repo.related(opening.id);
  expect(results.map(x => x.id)).toContain(matched.id); expect(results.map(x => x.id)).not.toContain(unrelated.id); expect(results.map(x => x.id)).not.toContain(foreign.id);
});
it("isolates video metadata and prevents foreign uploads/deletes", async () => {
  const a = openingRepository(db, owners[0]); const b = openingRepository(db, owners[1]); const opening = await a.create(repertoire);
  const id = randomUUID(); await a.addVideo(opening.id, { id, name: "Lesson", size: 123 });
  expect((await a.get(opening.id)).videos).toEqual([{ id, name: "Lesson", size: 123 }]);
  await expect(b.video(opening.id, id)).rejects.toMatchObject({ status: 404 });
  await expect(b.addVideo(opening.id, { id: randomUUID(), name: "Foreign", size: 100 })).rejects.toMatchObject({ status: 404 });
  await b.deleteVideo(opening.id, id); expect((await a.get(opening.id)).videos).toHaveLength(1);
  await a.deleteVideo(opening.id, id); expect((await a.get(opening.id)).videos).toHaveLength(0);
});
