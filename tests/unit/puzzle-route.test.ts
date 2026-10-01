import { beforeEach, expect, it, vi } from "vitest";
const { auth, generate, repository, summary, db } = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn(), repository: vi.fn(), summary: vi.fn(), db: {} }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/puzzles/generate", () => ({ generatePuzzles: generate }));
vi.mock("@/lib/puzzles/repository", () => ({ createPuzzleRepository: repository, puzzleSummary: summary, PUZZLE_FAILURE: "Puzzle generation failed. Please retry." }));
import { POST } from "@/app/api/games/[id]/puzzles/route";
const request = () => POST(new Request("http://localhost/api/games/game/puzzles", { method: "POST" }), { params: Promise.resolve({ id: "game" }) });
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "owner" }); });
it.each([401, 403])( "stops unauthenticated or forbidden requests before accessing data (%s)", async status => {
  auth.mockResolvedValue(Response.json({ error: { message: "Denied" } }, { status }));
  expect((await request()).status).toBe(status);
  expect(repository).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
});
it.each([["NOT_FOUND", 404], ["NOT_READY", 409], ["BUSY", 409], ["FAILED", 503]])("maps %s to HTTP %s", async (status, http) => {
  generate.mockResolvedValue({ status });
  expect((await request()).status).toBe(http);
  expect(repository).toHaveBeenCalledWith(db, "owner");
});
it("returns only the owner's summary on completion", async () => {
  generate.mockResolvedValue({ status: "COMPLETED" }); summary.mockResolvedValue({ status: "COMPLETED", count: 1 });
  const response = await request();
  expect(response.status).toBe(200);
  expect(summary).toHaveBeenCalledWith(db, "game", "owner");
  expect(await response.json()).toEqual({ generation: { status: "COMPLETED", count: 1 } });
});
it("sanitizes unexpected storage failures", async () => {
  generate.mockRejectedValue(new Error("private database URL"));
  const response = await request();
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("private");
});
