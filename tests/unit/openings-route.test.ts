import { beforeEach, expect, it, vi } from "vitest";
const { auth, get, update, create, db } = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), update: vi.fn(), create: vi.fn(), db: {} }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/openings/repository", () => ({ openingRepository: (_db: unknown, ownerId: string) => ({ get: (id: string) => get(ownerId, id), update: (id: string, revision: number, content: unknown) => update(ownerId, id, revision, content), create: (content: unknown) => create(ownerId, content) }) }));
import { GET, PUT } from "@/app/api/openings/[id]/route";
import { POST } from "@/app/api/openings/route";
import { EMPTY_OPENING, OpeningError } from "@/lib/openings/content";
const context = { params: Promise.resolve({ id: "opening" }) };
const content = { ...EMPTY_OPENING, name: "Opening" };
const request = (body: unknown, method = "PUT") => new Request("http://local/api/openings/opening", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "owner" }); });
it.each([401, 403])("authenticates before parsing or accessing private openings (%s)", async status => {
  auth.mockResolvedValue(Response.json({}, { status }));
  expect((await GET(new Request("http://local"), context)).status).toBe(status);
  expect((await PUT(request({}), context)).status).toBe(status);
  expect((await POST(request({}, "POST"))).status).toBe(status);
  expect(get).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
});
it("takes ownership from the session and prevents shared caching", async () => {
  get.mockResolvedValue({ id: "opening" });
  const result = await GET(new Request("http://local"), context); expect(get).toHaveBeenCalledWith("owner", "opening"); expect(result.headers.get("cache-control")).toBe("private, no-store");
  update.mockResolvedValue({ id: "opening" }); expect((await PUT(request({ content, revision: 0 }), context)).status).toBe(200); expect(update).toHaveBeenCalledWith("owner", "opening", 0, content);
});
it("rejects forged ownership, stale revisions and oversized data; sanitizes storage failures", async () => {
  expect((await PUT(request({ content: { ...content, ownerId: "foreign" }, revision: 0 }), context)).status).toBe(400);
  expect((await PUT(request({ content, revision: -1 }), context)).status).toBe(400); expect(update).not.toHaveBeenCalled();
  expect((await POST(request({ name: "x".repeat(500001) }, "POST"))).status).toBe(413);
  update.mockRejectedValue(new OpeningError("Changed", 409)); expect((await PUT(request({ content, revision: 0 }), context)).status).toBe(409);
  get.mockRejectedValue(new Error("private database password")); const result = await GET(new Request("http://local"), context); expect(result.status).toBe(503); expect(await result.text()).not.toContain("password");
});
