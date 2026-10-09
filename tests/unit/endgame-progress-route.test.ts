import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const { auth, save } = vi.hoisted(() => ({ auth: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/endgames/repository", () => ({ saveEndgameProgress: save }));
import { POST } from "@/app/api/endgames/[positionId]/progress/route";
const input = () => ({ requestId: randomUUID(), expectedRevision: 0, snapshot: { sessionId: randomUUID(), difficulty: "casual", moves: [], resigned: false, hintUsed: false, analysisUsed: false } });
const request = (body: unknown) => new Request("http://local/api/endgames/queen-white/progress", { method: "POST", body: JSON.stringify(body) });
const context = { params: Promise.resolve({ positionId: "queen-white" }) };
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "owner" }); save.mockResolvedValue({ status: "OK", progress: {} }); });
it.each([401, 403])("checks authentication and origin before writes (%s)", async status => {
  auth.mockResolvedValue(new Response(null, { status })); expect((await POST(request(input()), context)).status).toBe(status); expect(save).not.toHaveBeenCalled();
});
it("uses the authenticated owner, conceals cached progress, and returns conflicts", async () => {
  const body = input(); const result = await POST(request(body), context);
  expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(save).toHaveBeenCalledWith({}, "owner", expect.objectContaining({ id: "queen-white" }), body);
  save.mockResolvedValue({ status: "CONFLICT", progress: {} }); expect((await POST(request(body), context)).status).toBe(409);
});
it("rejects forged ownership, oversized requests, invalid histories and unknown positions before storage", async () => {
  for (const body of [{ ...input(), userId: "other" }, { ...input(), snapshot: { ...input().snapshot, moves: ["bad"] } }, { padding: "x".repeat(13000) }]) expect((await POST(request(body), context)).status).toBe(400);
  expect((await POST(request(input()), { params: Promise.resolve({ positionId: "unknown" }) })).status).toBe(404); expect(save).not.toHaveBeenCalled();
});
it("reports unavailable storage without leaking internal errors", async () => {
  save.mockRejectedValue(new Error("private database credential")); const response = await POST(request(input()), context);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("credential");
});
