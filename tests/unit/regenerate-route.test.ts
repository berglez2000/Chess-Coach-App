import { afterEach, expect, it, vi } from "vitest";
const { coach } = vi.hoisted(() => ({ coach: vi.fn() }));
vi.mock("@/lib/coaching/client", () => ({ coachSavedGame: coach }));
import { POST } from "@/app/api/games/[id]/coaching/route";
const post = (body = '{"expectedRevision":2}') => POST(new Request("http://localhost", { method: "POST", body }), { params: Promise.resolve({ id: "game" }) });
afterEach(() => vi.resetAllMocks());
it("passes the displayed revision to the coaching-only entry point", async () => {
  coach.mockResolvedValue({ status: "COMPLETED" });
  expect((await post()).status).toBe(200);
  expect(coach).toHaveBeenCalledWith("game", 2);
});
it.each(["{}", '{"expectedRevision":-1}', '{"expectedRevision":1.5}', '{"expectedRevision":2,"provider":"invalid"}', "bad"])("rejects missing/invalid regeneration intent (%#)", async body => {
  expect((await post(body)).status).toBe(400);
  expect(coach).not.toHaveBeenCalled();
});
it.each([["NOT_READY", 409], ["NO_ENGINE_DATA", 409], ["NOT_FOUND", 404]])("maps %s to %s", async (status, code) => {
  coach.mockResolvedValue({ status }); expect((await post()).status).toBe(code);
});
it("returns a safe error on unexpected failure", async () => {
  coach.mockRejectedValue(new Error("private"));
  const result = await post(); expect(result.status).toBe(503); expect(await result.text()).not.toContain("private");
});
