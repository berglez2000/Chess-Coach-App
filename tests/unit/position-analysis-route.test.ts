import { Chess, DEFAULT_POSITION } from "chess.js";
import { beforeEach, expect, it, vi } from "vitest";
const { auth, analyze, create } = vi.hoisted(() => ({ auth: vi.fn(), analyze: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireApiUser: auth }));
vi.mock("@/lib/engine/stockfish", () => ({ createStockfish: create }));
import { POST } from "@/app/api/analysis/route";
import { EngineError } from "@/lib/engine/error";
const body = { startFen: DEFAULT_POSITION, moves: [], preset: "quick" };
const request = (input: unknown = body, signal?: AbortSignal) => new Request("http://local/api/analysis", { method: "POST", body: JSON.stringify(input), signal });
const result = { perspective: "WHITE", bestMove: "e2e4", evaluation: null, variations: [
  { depth: 12, score: { kind: "cp", value: 32, bound: "exact" }, pv: ["e2e4", "e7e5"] },
  { depth: 12, score: { kind: "cp", value: 28, bound: "exact" }, pv: ["d2d4"] },
  { depth: 12, score: { kind: "cp", value: 14, bound: "exact" }, pv: ["g1f3"] },
] };
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ id: "owner" }); create.mockReturnValue({ analyze }); analyze.mockResolvedValue(result); });
it.each([401, 403])("checks session/origin before parsing or starting Stockfish (%s)", async status => {
  auth.mockResolvedValue(new Response(null, { status })); expect((await POST(request("bad"))).status).toBe(status); expect(create).not.toHaveBeenCalled();
});
it("streams progress and completion with a fixed budget, no shared caching and legal normalized lines", async () => {
  analyze.mockImplementation(async (_fen, options) => { options.onProgress(result); return result; });
  const response = await POST(request());
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  expect(events.map(event => event.type)).toEqual(["progress", "complete"]);
  expect(events[1].result.candidates[0].moves[0].san).toBe("e4");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ moveTimeMs: 1000, multiPv: 3 }));
  expect(analyze).toHaveBeenCalledWith(new Chess().fen(), expect.objectContaining({ signal: expect.any(AbortSignal), history: { startFen: DEFAULT_POSITION, moves: [] } }));
});
it("rejects illegal/oversized/forged requests without starting an engine", async () => {
  for (const input of [{ ...body, moves: ["e2e5"] }, { ...body, ownerId: "other" }, { ...body, preset: "infinite" }, { ...body, startFen: "x".repeat(10001) }]) expect((await POST(request(input))).status).toBe(400);
  expect(create).not.toHaveBeenCalled();
});
it("returns terminal positions without requiring Stockfish", async () => {
  const response = await POST(request({ ...body, startFen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1" }));
  expect(JSON.parse(await response.text()).result.terminal).toBe("checkmate"); expect(create).not.toHaveBeenCalled();
});
it("sanitizes failures and releases search capacity for retry", async () => {
  analyze.mockRejectedValueOnce(new Error("private executable path /secret"));
  const response = await POST(request()); expect(await response.text()).not.toContain("secret");
  analyze.mockRejectedValueOnce(new EngineError("TIMEOUT", "private"));
  expect(await (await POST(request())).text()).toContain("timed out");
  expect((await POST(request())).status).toBe(200);
});
it("cancels the engine when its response reader is cancelled and fences concurrent searches", async () => {
  let engineSignal: AbortSignal | undefined;
  analyze.mockImplementation((_fen, options) => new Promise((_resolve, reject) => { engineSignal = options.signal; options.signal.addEventListener("abort", () => reject(new EngineError("CANCELLED", "Cancelled"))); }));
  const response = await POST(request()); const reader = response.body!.getReader();
  expect((await POST(request())).status).toBe(429);
  await reader.cancel(); await vi.waitFor(() => expect(engineSignal?.aborted).toBe(true));
  analyze.mockResolvedValue(result); const retry = await POST(request()); expect(retry.status).toBe(200); await retry.text();
});
it("stops engine work when the request is aborted", async () => {
  let engineSignal: AbortSignal | undefined;
  analyze.mockImplementation((_fen, options) => new Promise((_resolve, reject) => { engineSignal = options.signal; options.signal.addEventListener("abort", () => reject(new EngineError("CANCELLED", "Cancelled"))); }));
  const controller = new AbortController(); const response = await POST(request(body, controller.signal));
  controller.abort(); await response.text(); expect(engineSignal?.aborted).toBe(true);
});
