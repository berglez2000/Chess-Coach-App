import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), list: vi.fn(), create: vi.fn(), coach: vi.fn(), analyze: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ game: { findUnique: mocks.find, findMany: mocks.list, create: mocks.create } }) }));
vi.mock("@/lib/coaching/client", () => ({ coachSavedGame: mocks.coach }));
vi.mock("@/lib/analysis/client", () => ({ analyzeSavedGame: mocks.analyze }));
import { GET as games, POST as create } from "@/app/api/games/route";
import { GET as detail } from "@/app/api/games/[id]/route";
import { POST as analyze } from "@/app/api/games/[id]/analyze/route";
import { POST as coach } from "@/app/api/games/[id]/coaching/route";
import { GET as settings, PUT as updateSettings } from "@/app/api/settings/route";
const params = { params: Promise.resolve({ id: "someone-elses-game" }) };
const request = (method = "POST", origin = "http://localhost:3000") => new Request("http://localhost:3000/api/games", { method, headers: { origin }, body: method === "GET" ? undefined : "{}" });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-at-least-thirty-two-characters");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  mocks.session.mockResolvedValue(null);
});
it("rejects anonymous or expired sessions on every data endpoint before accessing data", async () => {
  const responses = await Promise.all([games(), create(request()), detail(request("GET"), params), analyze(request(), params), coach(request(), params), settings(), updateSettings(request("PUT"))]);
  expect(responses.map(r => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  for (const fn of [mocks.find, mocks.list, mocks.create, mocks.coach, mocks.analyze]) expect(fn).not.toHaveBeenCalled();
});
it("blocks cross-origin writes even with a valid session", async () => {
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  expect((await create(request("POST", "https://other.example"))).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("scopes direct game reads and analysis lookups to the current user", async () => {
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.find.mockResolvedValue(null);
  expect((await detail(request("GET"), params)).status).toBe(404);
  expect((await analyze(request(), params)).status).toBe(404);
  for (const [query] of mocks.find.mock.calls) expect(query.where).toEqual({ id: "someone-elses-game", ownerId: "owner" });
  expect(mocks.analyze).not.toHaveBeenCalled();
  expect(mocks.coach).not.toHaveBeenCalled();
});
it("sanitizes authentication database failures", async () => {
  mocks.session.mockRejectedValue(new Error("private database password"));
  const result = await games();
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private database password");
});
