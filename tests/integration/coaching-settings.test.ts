import { createTestOwner } from "../support/test-owner";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getCoachingProvider, saveCoachingProvider, getCoachingSelection, saveCoachingSelection } from "@/lib/coaching/settings";
import { COACHING_MODELS, type CoachingProvider } from "@/lib/coaching/providers";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
let ownerId: string;
beforeAll(async () => {
  await assertTestDatabase(db);
  ownerId = await createTestOwner(db);
});
it("persists every model across database clients", async () => {
  for (const provider of Object.keys(COACHING_MODELS) as CoachingProvider[]) {
    for (const { id: model } of COACHING_MODELS[provider]) {
      await saveCoachingSelection(db, { provider, model }, ownerId);
      const reopened = createTestDb();
      try { expect(await getCoachingSelection(reopened, ownerId)).toEqual({ provider, model }); }
      finally { await reopened.$disconnect(); }
    }
  }
});
afterAll(async () => {
  await assertTestDatabase(db);
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.$disconnect();
});
it("persists both choices across new database clients and rejects unsupported values", async () => {
  for (const provider of ["OPENAI", "ANTHROPIC"] as const) {
    await saveCoachingProvider(db, provider, ownerId);
    const reopened = createTestDb();
    try { expect(await getCoachingProvider(reopened, ownerId)).toBe(provider); }
    finally { await reopened.$disconnect(); }
  }
  await expect(saveCoachingProvider(db, "unsupported", ownerId)).rejects.toThrow();
  expect(await getCoachingProvider(db, ownerId)).toBe("ANTHROPIC");
});
