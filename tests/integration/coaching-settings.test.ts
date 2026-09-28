import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getCoachingProvider, saveCoachingProvider } from "@/lib/coaching/settings";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
let original: Awaited<ReturnType<typeof db.appSettings.findUnique>>;
beforeAll(async () => {
  await assertTestDatabase(db);
  original = await db.appSettings.findUnique({ where: { id: "local" } });
});
afterAll(async () => {
  await assertTestDatabase(db);
  if (original) await db.appSettings.upsert({ where: { id: "local" }, create: original, update: original });
  else await db.appSettings.deleteMany({ where: { id: "local" } });
  await db.$disconnect();
});
it("persists both choices across new database clients and rejects unsupported values", async () => {
  for (const provider of ["OPENAI", "ANTHROPIC"] as const) {
    await saveCoachingProvider(db, provider);
    const reopened = createTestDb();
    try { expect(await getCoachingProvider(reopened)).toBe(provider); }
    finally { await reopened.$disconnect(); }
  }
  await expect(saveCoachingProvider(db, "unsupported")).rejects.toThrow();
  expect(await getCoachingProvider(db)).toBe("ANTHROPIC");
});
