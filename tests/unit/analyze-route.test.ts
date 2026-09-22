import { expect, it, vi } from "vitest";
const { analyze } = vi.hoisted(() => ({ analyze: vi.fn() }));
vi.mock("@/lib/analysis/client", () => ({ analyzeSavedGame: analyze }));
import { POST } from "@/app/api/games/[id]/analyze/route";
const request = () => POST(new Request("http://localhost/api/games/game/analyze", { method: "POST" }), { params: Promise.resolve({ id: "game" }) });
it.each([
  [{ status: "ENGINE_COMPLETED", analyzedMoves: 2 }, 200, null],
  [{ status: "NOT_FOUND" }, 404, "GAME_NOT_FOUND"],
  [{ status: "NOT_READY" }, 409, "ANALYSIS_NOT_READY"],
  [{ status: "FAILED", code: "ANALYSIS_FAILED", message: "Safe failure" }, 500, "ANALYSIS_FAILED"],
])("maps application outcome to stable HTTP response (%#)", async (result, status, code) => {
  analyze.mockResolvedValueOnce(result);
  const response = await request();
  expect(response.status).toBe(status);
  if (code) expect(await response.json()).toHaveProperty("error.code", code);
});
it("sanitizes unexpected setup errors", async () => {
  analyze.mockRejectedValueOnce(new Error("private database URL"));
  const response = await request();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});
