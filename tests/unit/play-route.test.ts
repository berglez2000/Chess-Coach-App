import { DEFAULT_POSITION } from "chess.js";
import { beforeEach, expect, it, vi } from "vitest";
const { auth, analyze, create } = vi.hoisted(() => ({ auth: vi.fn(), analyze: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/engine/stockfish", () => ({ createStockfish: create }));
import { POST } from "@/app/api/play/route";
import { DIFFICULTIES } from "@/lib/play/contract";
const body = { startFen: DEFAULT_POSITION, moves: [], color: "BLACK", difficulty: "casual" };
const request = (input: unknown = body, signal?: AbortSignal) => new Request("http://local/api/play", { method: "POST", body: JSON.stringify(input), signal });
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "play-owner" }); create.mockReturnValue({ analyze }); analyze.mockResolvedValue({ bestMove: "e2e4" }); });
it.each([401,403])("checks session/origin before engine access (%s)", async status => { auth.mockResolvedValue(new Response(null, { status })); expect((await POST(request("bad"))).status).toBe(status); expect(create).not.toHaveBeenCalled(); });
it.each(Object.keys(DIFFICULTIES))("bounds difficulty %s and returns a private reply", async difficulty => {
  const response = await POST(request({ ...body, difficulty }));
  expect(await response.json()).toEqual({ move: "e2e4", fen: DEFAULT_POSITION });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ skillLevel: DIFFICULTIES[difficulty as keyof typeof DIFFICULTIES].skillLevel }));
});
it("replays Black replies from complete legal history", async () => {
  analyze.mockResolvedValue({ bestMove: "e7e5" });
  expect((await POST(request({ ...body, color: "WHITE", moves: ["e2e4"] }))).status).toBe(200);
  expect(analyze).toHaveBeenCalledWith(expect.stringContaining(" b "), expect.objectContaining({ history: { startFen: DEFAULT_POSITION, moves: ["e2e4"] } }));
});
it("rejects illegal, wrong-turn, forged, unsupported, and oversized input", async () => {
  for (const input of [{ ...body, moves: ["e2e5"] }, { ...body, color: "WHITE" }, { ...body, userId: "other" }, { ...body, difficulty: "unlimited" }, { ...body, startFen: "x".repeat(11000) }]) expect((await POST(request(input))).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("handles custom terminal starts without spawning", async () => {
  expect(await (await POST(request({ ...body, startFen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1" }))).json()).toMatchObject({ move: null }); expect(create).not.toHaveBeenCalled();
});
it("sanitizes engine failures and releases capacity for retry", async () => {
  analyze.mockRejectedValueOnce(new Error("/private/key"));
  const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private/key");
  expect((await POST(request())).status).toBe(200);
});
it("fences concurrent requests and passes abort to the process", async () => {
  analyze.mockImplementation((_fen, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("cancelled")))));
  const controller = new AbortController(); const pending = POST(request(body,controller.signal));
  await vi.waitFor(() => expect(analyze).toHaveBeenCalled());
  expect((await POST(request())).status).toBe(429); controller.abort(); expect((await pending).status).toBe(503);
  analyze.mockResolvedValue({ bestMove: "e2e4" }); expect((await POST(request())).status).toBe(200);
});
