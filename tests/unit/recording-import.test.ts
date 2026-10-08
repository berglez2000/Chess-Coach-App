import { expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createImportRepository } from "@/lib/games/import-repository";
import { importGame } from "@/lib/games/import-game";
import { parsePgn } from "@/lib/pgn/parse";

const recordingId = "12345678-1234-4234-8234-123456789abc";
const game = parsePgn("1. e4 e5 *");
function database() {
  const rows = new Map<string, { id: string; ownerId: string; pgn: string; userColor: string }>();
  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null);
  const create = vi.fn(async ({ data }: { data: { id: string; ownerId: string; pgn: string; userColor: string } }) => {
    if (rows.has(data.id)) throw { code: "P2002" };
    rows.set(data.id, data); return { id: data.id };
  });
  return { db: { game: { findUnique, create } } as unknown as PrismaClient, create, rows };
}
it("repeated and concurrent saves produce a single owned game", async () => {
  const { db, rows } = database(); const repo = createImportRepository(db, "owner");
  const results = await Promise.all([repo.create(game, "WHITE", recordingId), repo.create(game, "WHITE", recordingId)]);
  expect(results[0]).toEqual(results[1]);
  expect(await repo.create(game, "WHITE", recordingId)).toEqual(results[0]);
  expect(rows.size).toBe(1);
});
it("scopes retry keys to the owner and rejects a changed snapshot", async () => {
  const { db, rows } = database(); const a = createImportRepository(db, "alice"); const b = createImportRepository(db, "bob");
  const savedA = await a.create(game, "WHITE", recordingId); const savedB = await b.create(game, "WHITE", recordingId);
  expect(savedA.id).not.toBe(savedB.id); expect(rows.size).toBe(2);
  await expect(a.create(parsePgn("1. d4 *"), "WHITE", recordingId)).rejects.toThrow("snapshot differs");
  await expect(a.create(game, "BLACK", recordingId)).rejects.toThrow("snapshot differs");
});
it("validates recording IDs before calling the repository", async () => {
  const create = vi.fn();
  expect(await importGame({ userColor: "WHITE", pgn: "1. e4 *", recordingId: "bad" }, { create })).toHaveProperty("error");
  expect(create).not.toHaveBeenCalled();
});
