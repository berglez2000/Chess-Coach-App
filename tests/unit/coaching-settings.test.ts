vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "test-user" }), requireApiUser: async () => ({ id: "test-user" }) }));
import { afterEach, expect, it, vi } from "vitest";
const { findUnique, upsert } = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ userSettings: { findUnique, upsert } }) }));
import { GET, PUT } from "@/app/api/settings/route";
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
it("defaults to Anthropic and returns availability only, never credentials", async () => {
  findUnique.mockResolvedValue(null);
  vi.stubEnv("ANTHROPIC_API_KEY", "private-anthropic"); vi.stubEnv("OPENAI_API_KEY", "");
  const response = await GET();
  expect(await response.json()).toEqual({ provider: "ANTHROPIC", available: { ANTHROPIC: true, OPENAI: false } });
  expect(upsert).not.toHaveBeenCalled();
});
it.each(["ANTHROPIC", "OPENAI"])("persists %s and reads it on subsequent requests", async provider => {
  findUnique.mockResolvedValue({ coachingProvider: provider });
  const result = await PUT(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ provider }) }));
  expect(result.status).toBe(200);
  expect(upsert).toHaveBeenCalledWith({ where: { userId: "test-user" }, create: { userId: "test-user", coachingProvider: provider }, update: { coachingProvider: provider } });
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
