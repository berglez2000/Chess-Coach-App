vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "test-user" }), requireApiUser: async () => ({ id: "test-user" }) }));
import { afterEach, expect, it, vi } from "vitest";
const { findUnique, upsert } = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ userSettings: { findUnique, upsert } }) }));
import { COACHING_MODELS, PROVIDERS } from "@/lib/coaching/providers";
import { GET, PUT } from "@/app/api/settings/route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
it("defaults to Anthropic and returns availability only, never credentials", async () => {
  findUnique.mockResolvedValue(null);
  vi.stubEnv("ANTHROPIC_API_KEY", "private-anthropic"); vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("DEEPSEEK_API_KEY", "");
  const response = await GET();
  expect(await response.json()).toEqual({ provider: "ANTHROPIC", model: "claude-haiku-4-5", available: { ANTHROPIC: true, OPENAI: false, DEEPSEEK: false } });
  expect(upsert).not.toHaveBeenCalled();
});
it.each(["ANTHROPIC", "OPENAI", "DEEPSEEK"] as const)("persists %s and reads it on subsequent requests", async provider => {
  findUnique.mockResolvedValue({ coachingProvider: provider });
  const result = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ provider }) }));
  expect(result.status).toBe(200);
  expect(upsert).toHaveBeenCalledWith({ where: { userId: "test-user" }, create: { userId: "test-user", coachingProvider: provider, coachingModel: PROVIDERS[provider].model }, update: { coachingProvider: provider, coachingModel: PROVIDERS[provider].model } });
  expect(await (await GET()).json()).toMatchObject({ provider });
});
it.each(['{"provider":"invalid"}', '{"provider":"OPENAI","apiKey":"secret"}', 'null', 'broken'])("rejects invalid input before database access (%#)", async body => {
  expect((await PUT(new Request("http://localhost", { method: "PUT", body }))).status).toBe(400);
  expect(upsert).not.toHaveBeenCalled();
});
it("sanitizes settings database failures", async () => {
  findUnique.mockRejectedValue(new Error("private URL"));
  const result = await GET();
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private");
});
it.each(Object.entries(COACHING_MODELS).flatMap(([provider, models]) => models.map(model => [provider, model.id])))
  ("persists and returns the selected model %s/%s", async (provider, model) => {
    findUnique.mockResolvedValue({ coachingProvider: provider, coachingModel: model });
    const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ provider, model }) }));
    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { coachingProvider: provider, coachingModel: model } }));
    expect(await response.json()).toMatchObject({ provider, model });
  });
it.each([
  { provider: "OPENAI", model: "claude-opus-4-6" },
  { provider: "ANTHROPIC", model: "gpt-5.4" },
  { provider: "OPENAI", model: "invented-model" },
  { provider: "OPENAI", model: null },
  { provider: "DEEPSEEK", model: "gpt-5.4" },
])("rejects unsupported model selections before writing (%j)", async selection => {
  const response = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify(selection) }));
  expect(response.status).toBe(400);
  expect(upsert).not.toHaveBeenCalled();
});
it("keeps the previous provider default for existing settings without a model", async () => {
  findUnique.mockResolvedValue({ coachingProvider: "OPENAI", coachingModel: null });
  expect(await (await GET()).json()).toMatchObject({ provider: "OPENAI", model: "gpt-5.4-mini" });
});
it("reports DeepSeek key availability without exposing the key", async () => {
  findUnique.mockResolvedValue({ coachingProvider: "DEEPSEEK", coachingModel: "deepseek-v4-pro" });
  vi.stubEnv("DEEPSEEK_API_KEY", "private-deepseek-key");
  const body = await (await GET()).json();
  expect(body).toMatchObject({ provider: "DEEPSEEK", model: "deepseek-v4-pro", available: { DEEPSEEK: true } });
  expect(JSON.stringify(body)).not.toContain("private-deepseek-key");
});
