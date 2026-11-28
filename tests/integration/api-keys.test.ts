import { createTestOwner } from "../support/test-owner";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { deletePersonalApiKey, getPersonalApiKey, savePersonalApiKey } from "@/lib/coaching/api-keys";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { assertTestDatabase, createTestDb } from "../support/database";
const db = createTestDb();
const key = "sk-integration-fixture-key-00004321";
let ownerId: string; let otherId: string;
beforeAll(async () => {
  await assertTestDatabase(db);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "integration-encryption-secret-0123456789");
  for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"]) vi.stubEnv(name, "");
  ownerId = await createTestOwner(db); otherId = await createTestOwner(db);
});
it("persists one encrypted key per user and provider across database clients", async () => {
  await savePersonalApiKey(db, ownerId, "OPENAI", "sk-integration-fixture-key-replaced-0000");
  await savePersonalApiKey(db, ownerId, "OPENAI", key);
  const stored = await db.userApiKey.findMany({ where: { userId: ownerId } });
  expect(stored).toHaveLength(1);
  expect(stored[0].ciphertext).not.toContain("integration-fixture");
  const reopened = createTestDb();
  try {
    expect(await getPersonalApiKey(reopened, ownerId, "OPENAI")).toBe(key);
    expect(await getPersonalApiKey(reopened, otherId, "OPENAI")).toBeNull();
    expect(await getCoachingSettings(reopened, ownerId)).toMatchObject({ available: { ANTHROPIC: false, OPENAI: true, DEEPSEEK: false }, personalKeys: { OPENAI: { lastFour: "4321", readable: true } } });
    expect(await getCoachingSettings(reopened, otherId)).toMatchObject({ available: { OPENAI: false }, personalKeys: {} });
  } finally { await reopened.$disconnect(); }
  await deletePersonalApiKey(db, ownerId, "OPENAI");
  expect(await getPersonalApiKey(db, ownerId, "OPENAI")).toBeNull();
});
it("deletes stored keys with the account", async () => {
  await savePersonalApiKey(db, otherId, "DEEPSEEK", key);
  await db.user.delete({ where: { id: otherId } });
  expect(await db.userApiKey.count({ where: { userId: otherId } })).toBe(0);
});
afterAll(async () => {
  await assertTestDatabase(db);
  await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
