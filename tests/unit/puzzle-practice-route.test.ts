import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const { auth, act, find, db } = vi.hoisted(() => ({ auth: vi.fn(), act: vi.fn(), find: vi.fn(), db: {} }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/puzzles/practice-repository", () => ({ actOnPuzzle: act, findPracticePuzzle: find }));
import { GET, POST } from "@/app/api/puzzles/[id]/route";
const context = { params: Promise.resolve({ id: "puzzle" }) };
const action = () => ({ requestId: randomUUID(), expectedRevision: 0, action: "MOVE", move: "e2e4" });
const post = (body: unknown) => POST(new Request("http://localhost/api/puzzles/puzzle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), context);
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "owner" }); });
it.each([401, 403])("authenticates before reading or mutating a puzzle (%s)", async status => {
  auth.mockResolvedValue(Response.json({}, { status }));
  expect((await GET(new Request("http://localhost/api/puzzles/puzzle"), context)).status).toBe(status);
  expect((await post(action())).status).toBe(status);
  expect(find).not.toHaveBeenCalled(); expect(act).not.toHaveBeenCalled();
});
it("scopes GET by user and disables shared caching", async () => {
  find.mockResolvedValue({ id: "puzzle", solution: null });
  const result = await GET(new Request("http://localhost/api/puzzles/puzzle"), context);
  expect(find).toHaveBeenCalledWith(db, "puzzle", "owner");
  expect(result.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects fabricated correctness, assistance and malformed requests", async () => {
  expect((await post({ ...action(), correct: true })).status).toBe(400);
  expect((await post({ ...action(), assisted: false })).status).toBe(400);
  expect((await post({ ...action(), expectedRevision: -1 })).status).toBe(400);
  expect(act).not.toHaveBeenCalled();
});
it("passes only validated actions and session ownership to the repository", async () => {
  const body = action(); act.mockResolvedValue({ status: "OK", puzzle: { solution: null } });
  expect((await post(body)).status).toBe(200);
  expect(act).toHaveBeenCalledWith(db, "puzzle", "owner", body);
});
it("returns the latest saved DTO on conflict and hides missing/private puzzles", async () => {
  act.mockResolvedValueOnce({ status: "CONFLICT", puzzle: { id: "puzzle", solution: null } });
  const result = await post(action()); expect(result.status).toBe(409);
  expect(await result.json()).toHaveProperty("puzzle.solution", null);
  act.mockResolvedValueOnce({ status: "NOT_FOUND" }); expect((await post(action())).status).toBe(404);
  find.mockResolvedValueOnce(null); expect((await GET(new Request("http://localhost/api/puzzles/puzzle"), context)).status).toBe(404);
});
it("sanitizes storage failures", async () => {
  act.mockRejectedValue(new Error("private database URL"));
  const response = await post(action()); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private database");
});
