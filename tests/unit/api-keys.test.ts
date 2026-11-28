vi.mock("@/lib/auth/session", () => ({ requireApiUser: async () => ({ id: "test-user" }) }));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
type Row = { userId: string; provider: string; ciphertext: string; lastFour: string };
const { rows, db } = vi.hoisted(() => {
  const rows: Row[] = [];
  const at = (userId: string, provider: string) => rows.findIndex(row => row.userId === userId && row.provider === provider);
  const userApiKey = {
    findUnique: async ({ where: { userId_provider: { userId, provider } } }: { where: { userId_provider: Row } }) => rows[at(userId, provider)] ?? null,
    findMany: async ({ where }: { where: { userId: string } }) => rows.filter(row => row.userId === where.userId),
    upsert: async ({ create, update }: { create: Row; update: Partial<Row> }) => {
      const index = at(create.userId, create.provider);
      if (index < 0) rows.push({ ...create }); else Object.assign(rows[index], update);
    },
    deleteMany: async ({ where }: { where: { userId: string; provider: string } }) => { const index = at(where.userId, where.provider); if (index >= 0) rows.splice(index, 1); },
  };
  return { rows, db: { userApiKey, userSettings: { findUnique: async () => null } } };
});
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
import type { PrismaClient } from "@/generated/prisma/client";
import { deletePersonalApiKey, getPersonalApiKey, listPersonalApiKeys, personalKeysEnabled, savePersonalApiKey } from "@/lib/coaching/api-keys";
import { createCoachingClient, type CoachingRequest } from "@/lib/coaching/ai-client";
import { createPlanClient } from "@/lib/weekly-plan/ai-client";
import { fixtureInputs } from "../support/weekly-plan-fixtures";
import { PUT, DELETE } from "@/app/api/settings/keys/[provider]/route";

const prisma = db as unknown as PrismaClient;
const secret = "unit-test-encryption-secret-0123456789";
const personal = "sk-personal-fixture-key-000000001234";
const context = (provider: string) => ({ params: Promise.resolve({ provider }) });
const put = (provider: string, body: unknown) => PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }), context(provider));
beforeEach(() => { rows.length = 0; vi.stubEnv("API_KEY_ENCRYPTION_SECRET", secret); for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "DEEPSEEK_API_KEY"]) vi.stubEnv(name, ""); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("stores a key encrypted and returns it only to its owner and provider", async () => {
  await savePersonalApiKey(prisma, "owner", "OPENAI", personal);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain(personal.slice(0, -4));
  expect(rows[0]).toMatchObject({ lastFour: "1234", ciphertext: expect.stringMatching(/^v1\./) });
  expect(await getPersonalApiKey(prisma, "owner", "OPENAI")).toBe(personal);
  expect(await getPersonalApiKey(prisma, "owner", "ANTHROPIC")).toBeNull();
  expect(await getPersonalApiKey(prisma, "someone-else", "OPENAI")).toBeNull();
  expect(await listPersonalApiKeys(prisma, "owner")).toEqual({ OPENAI: { lastFour: "1234", readable: true } });
  const first = rows[0].ciphertext;
  await savePersonalApiKey(prisma, "owner", "OPENAI", personal);
  expect(rows).toHaveLength(1);
  expect(rows[0].ciphertext).not.toBe(first);
  await deletePersonalApiKey(prisma, "owner", "OPENAI");
  expect(rows).toHaveLength(0);
});
it("refuses a ciphertext moved to another user, another provider, or altered", async () => {
  await savePersonalApiKey(prisma, "owner", "OPENAI", personal);
  rows.push({ ...rows[0], userId: "thief" }, { ...rows[0], provider: "DEEPSEEK" });
  expect(await getPersonalApiKey(prisma, "thief", "OPENAI")).toBeNull();
  expect(await getPersonalApiKey(prisma, "owner", "DEEPSEEK")).toBeNull();
  expect(await listPersonalApiKeys(prisma, "owner")).toEqual({ OPENAI: { lastFour: "1234", readable: true }, DEEPSEEK: { lastFour: "1234", readable: false } });
  rows[0].ciphertext = rows[0].ciphertext.slice(0, -2) + (rows[0].ciphertext.endsWith("AA") ? "BB" : "AA");
  expect(await getPersonalApiKey(prisma, "owner", "OPENAI")).toBeNull();
  await expect(getPersonalApiKey(prisma, "", "OPENAI")).rejects.toThrow();
});
it("reports a key as unreadable after the encryption secret changes", async () => {
  await savePersonalApiKey(prisma, "owner", "ANTHROPIC", personal);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET", "a-different-encryption-secret-9876543210");
  expect(await getPersonalApiKey(prisma, "owner", "ANTHROPIC")).toBeNull();
  expect(await listPersonalApiKeys(prisma, "owner")).toEqual({ ANTHROPIC: { lastFour: "1234", readable: false } });
});
it.each(["", "too-short"])("turns personal keys off without a usable secret (%#)", async value => {
  await savePersonalApiKey(prisma, "owner", "OPENAI", personal);
  vi.stubEnv("API_KEY_ENCRYPTION_SECRET", value);
  expect(personalKeysEnabled()).toBe(false);
  expect(await getPersonalApiKey(prisma, "owner", "OPENAI")).toBeNull();
  expect(await listPersonalApiKeys(prisma, "owner")).toBeNull();
  await expect(savePersonalApiKey(prisma, "owner", "OPENAI", personal)).rejects.toThrow();
  expect((await put("OPENAI", { apiKey: personal })).status).toBe(409);
});

it("saves and removes a key through the API without ever returning it", async () => {
  vi.stubEnv("ANTHROPIC_API_KEY", "server-anthropic-key");
  const savedResponse = await put("OPENAI", { apiKey: `  ${personal}\n` });
  expect(savedResponse.status).toBe(200);
  const text = await savedResponse.text();
  expect(text).not.toContain(personal.slice(0, -4));
  expect(text).not.toContain("server-anthropic-key");
  expect(JSON.parse(text)).toMatchObject({ available: { ANTHROPIC: true, OPENAI: true, DEEPSEEK: false }, personalKeys: { OPENAI: { lastFour: "1234", readable: true } } });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ userId: "test-user", provider: "OPENAI" });
  const removed = await DELETE(new Request("http://localhost", { method: "DELETE" }), context("OPENAI"));
  expect(await removed.json()).toMatchObject({ available: { OPENAI: false }, personalKeys: {} });
  expect(rows).toHaveLength(0);
});
it.each([
  ["OPENAI", { apiKey: "short" }], ["OPENAI", { apiKey: "has spaces inside the pasted key value" }], ["OPENAI", { apiKey: personal, userId: "forged" }],
  ["OPENAI", {}], ["OPENAI", null], ["openai", { apiKey: personal }], ["INVENTED", { apiKey: personal }],
])("rejects invalid key input before storing anything (%s %j)", async (provider, body) => {
  expect((await put(provider, body)).status).toBe(400);
  expect(rows).toHaveLength(0);
});
it("rejects removal for an unsupported provider", async () => {
  expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), context("INVENTED"))).status).toBe(400);
});

const unauthorized = () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, headers: { "content-type": "application/json" } });
it.each([["ANTHROPIC", "x-api-key", ""], ["OPENAI", "authorization", "Bearer "], ["DEEPSEEK", "authorization", "Bearer "]] as const)
  ("sends the user's %s key instead of the server key, and falls back to the server key without one", async (provider, header, prefix) => {
    vi.stubEnv(`${provider}_API_KEY`, "server-key");
    const fetch = vi.fn().mockImplementation(async () => unauthorized()); vi.stubGlobal("fetch", fetch);
    const request = { payload: { systemPrompt: "s", userMessage: "u", responseSchema: {} } } as unknown as CoachingRequest;
    await createCoachingClient(provider, undefined, personal).requestCoaching(request);
    await createPlanClient(provider, undefined, personal).generate(fixtureInputs, new AbortController().signal);
    await createCoachingClient(provider, undefined, null).requestCoaching(request);
    await createPlanClient(provider).generate(fixtureInputs, new AbortController().signal);
    expect(fetch.mock.calls.map(([, init]) => new Headers(init.headers).get(header))).toEqual([personal, personal, "server-key", "server-key"].map(key => prefix + key));
  });
it("uses a personal key when the server has none", async () => {
  const fetch = vi.fn().mockImplementation(async () => unauthorized()); vi.stubGlobal("fetch", fetch);
  await createPlanClient("OPENAI", undefined, personal).generate(fixtureInputs, new AbortController().signal);
  expect(fetch).toHaveBeenCalledOnce();
  expect(await createPlanClient("OPENAI").generate(fixtureInputs, new AbortController().signal)).toMatchObject({ status: "FAILED", message: expect.stringContaining("no API key") });
  expect(fetch).toHaveBeenCalledOnce();
});
