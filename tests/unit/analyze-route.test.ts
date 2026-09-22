import { expect, it, vi } from "vitest";
const { analyze, coach } = vi.hoisted(() => ({ analyze: vi.fn(), coach: vi.fn() }));
vi.mock("@/lib/analysis/client", () => ({ analyzeSavedGame: analyze }));
vi.mock("@/lib/coaching/client", () => ({ coachSavedGame: coach }));
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
