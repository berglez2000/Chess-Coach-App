import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { models, clients } = vi.hoisted(() => ({ models: { User: "User", Game: "Game" } as Record<string, string>, clients: [] as { $disconnect: ReturnType<typeof vi.fn> }[] }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { ModelName: models }, PrismaClient: class { $disconnect = vi.fn().mockResolvedValue(undefined); constructor() { clients.push(this); } } }));
vi.mock("@/lib/db/config", () => ({ readDatabaseUrl: () => "postgresql://test@localhost/test" }));
import { getDb } from "@/lib/db/client";
const cache = globalThis as unknown as { chessCoachDb?: ReturnType<typeof getDb>; chessCoachDbModels?: string };
let previous: typeof cache;
beforeEach(() => { previous = { chessCoachDb: cache.chessCoachDb, chessCoachDbModels: cache.chessCoachDbModels }; delete cache.chessCoachDb; delete cache.chessCoachDbModels; delete models.Opening; clients.length = 0; });
afterEach(() => { cache.chessCoachDb = previous.chessCoachDb; cache.chessCoachDbModels = previous.chessCoachDbModels; });
it("reuses the client during ordinary HMR with the same models", () => { const first = getDb(); expect(getDb()).toBe(first); expect(clients).toHaveLength(1); });
it("replaces a pre-existing singleton without a schema stamp", () => {
  const disconnect = vi.fn().mockResolvedValue(undefined); cache.chessCoachDb = { $disconnect: disconnect } as unknown as ReturnType<typeof getDb>;
  expect(getDb()).not.toEqual({ $disconnect: disconnect }); expect(disconnect).toHaveBeenCalledOnce(); expect(cache.chessCoachDbModels).toBe("Game|User");
});
it("refreshes the client after generated models change and retires the old pool", () => {
  const first = getDb(); models.Opening = "Opening"; const next = getDb(); expect(next).not.toBe(first); expect(first.$disconnect).toHaveBeenCalledOnce(); expect(getDb()).toBe(next); expect(clients).toHaveLength(2);
});
