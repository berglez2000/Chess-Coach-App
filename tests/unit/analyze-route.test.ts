import { expect, it, vi } from "vitest";
const { analyze, coach, findUnique } = vi.hoisted(() => ({ analyze: vi.fn(), coach: vi.fn(), findUnique: vi.fn().mockResolvedValue({ analysisStatus: "PENDING" }) }));
vi.mock("@/lib/analysis/client", () => ({ analyzeSavedGame: analyze }));
vi.mock("@/lib/coaching/client", () => ({ coachSavedGame: coach }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({ game: { findUnique } }) }));
import { POST } from "@/app/api/games/[id]/analyze/route";
const request = () => POST(new Request("http://localhost/api/games/game/analyze", { method: "POST" }), { params: Promise.resolve({ id: "game" }) });
const engineCompleted = { status: "ENGINE_COMPLETED", analyzedMoves: 2 };
it.each([
  [{ status: "NOT_FOUND" }, 404, "GAME_NOT_FOUND"],
  [{ status: "NOT_READY" }, 409, "ANALYSIS_NOT_READY"],
  [{ status: "FAILED", code: "ANALYSIS_FAILED", message: "Safe failure" }, 500, "ANALYSIS_FAILED"],
])("maps engine failure to stable HTTP response (%#)", async (result, status, code) => {
  analyze.mockResolvedValueOnce(result);
  const response = await request();
  expect(response.status).toBe(status);
  if (code) expect(await response.json()).toHaveProperty("error.code", code);
});
it("returns combined engine+coaching result on success", async () => {
  analyze.mockResolvedValueOnce(engineCompleted);
  coach.mockResolvedValueOnce({ status: "COMPLETED", annotatedMoments: 3 });
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("engine.status", "ENGINE_COMPLETED");
  expect(body).toHaveProperty("coaching.status", "COMPLETED");
});
it("returns 200 with coaching failure included when coaching fails non-fatally", async () => {
  analyze.mockResolvedValueOnce(engineCompleted);
  coach.mockResolvedValueOnce({ status: "AI_FAILED", code: "MISSING_KEY", message: "No key." });
  const response = await request();
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("engine.status", "ENGINE_COMPLETED");
  expect(body).toHaveProperty("coaching.status", "AI_FAILED");
});
it("sanitizes unexpected setup errors", async () => {
  analyze.mockRejectedValueOnce(new Error("private database URL"));
  const response = await request();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});

it.each(["ENGINE_COMPLETED", "AI_RUNNING"])("routes %s retries directly to coaching", async analysisStatus => {
  analyze.mockClear();
  findUnique.mockResolvedValueOnce({ analysisStatus });
  coach.mockResolvedValueOnce({ status: "COMPLETED", annotatedMoments: 0 });
  expect((await request()).status).toBe(200);
  expect(analyze).not.toHaveBeenCalled();
});
it("rejects a stale coaching retry when the server lease is active", async () => {
  findUnique.mockResolvedValueOnce({ analysisStatus: "AI_RUNNING" });
  coach.mockResolvedValueOnce({ status: "NOT_READY" });
  expect((await request()).status).toBe(409);
});
it("sanitizes a database outage before starting either stage", async () => {
  findUnique.mockRejectedValueOnce(new Error("private credentials"));
  const response = await request();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});
