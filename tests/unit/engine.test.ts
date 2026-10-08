import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { createStockfish } from "@/lib/engine/stockfish";
import { parseInfo, parseBestMove } from "@/lib/engine/protocol";
import { readEngineConfig } from "@/lib/engine/config";

const fen = new Chess().fen();
const config = { path: "/test/stockfish", depth: 12, timeoutMs: 100 };
function processFixture(output = "info depth 12 score cp 30 pv e2e4 e7e5\nbestmove e2e4\n", options: { hang?: boolean; noQuit?: boolean; noInit?: boolean; exit?: boolean } = {}) {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const commands: string[] = [];
  const close = () => child.emit("close", 0, null);
  const stdin = new Writable({ write(chunk, _encoding, done) {
    const command = chunk.toString().trim(); commands.push(command);
    queueMicrotask(() => {
      if (command === "uci" && !options.noInit) { stdout.write("uci"); stdout.write("ok\r\n"); }
      if (command === "isready") stdout.write("readyok\n");
      if (command.startsWith("go") && options.exit) close();
      else if (command.startsWith("go") && !options.hang) {
        // All protocol output is deliberately fragmented.
        for (const character of output) stdout.write(character);
      }
      if (command === "quit" && !options.noQuit) close();
    });
    done();
  } });
  Object.assign(child, { stdin, stdout, stderr, kill: vi.fn(() => { close(); return true; }), unref: vi.fn() });
  return { child, commands, start: vi.fn(() => child) };
}
afterEach(() => vi.useRealTimers());
it("handles fragmented protocol, returns cp/PV and closes all streams/listeners", async () => {
  const fixture = processFixture();
  expect(await createStockfish(config, fixture.start).analyze(fen)).toEqual({ perspective: "WHITE", bestMove: "e2e4", evaluation: { depth: 12, score: { kind: "cp", value: 30, bound: "exact" }, pv: ["e2e4", "e7e5"] } });
  expect(fixture.commands).toEqual(["uci", "setoption name Threads value 1", "setoption name Hash value 16", "setoption name MultiPV value 1", "ucinewgame", "isready", `position fen ${fen}`, "go depth 12", "stop", "quit"]);
  expect(fixture.child.stdout.destroyed).toBe(true);
  expect(fixture.child.stdin.destroyed).toBe(true);
  expect(fixture.child.listenerCount("close")).toBe(0);
  expect(fixture.child.kill).not.toHaveBeenCalled();
});
it("preserves Black perspective and a negative mate bound in timed mode", async () => {
  const board = new Chess(); board.move("e4");
  const fixture = processFixture("info depth 8 score mate -3 upperbound pv e7e5\nbestmove e7e5 ponder g1f3\n");
  const result = await createStockfish({ ...config, moveTimeMs: 10 }, fixture.start).analyze(board.fen());
  expect(result).toMatchObject({ perspective: "BLACK", evaluation: { score: { kind: "mate", value: -3, bound: "upper" } } });
  expect(fixture.commands).toContain("go movetime 10");
});
it.each([
  ["7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", "mate 0"],
  ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "cp 0"],
])("handles terminal positions without fabricated moves (%#)", async (position, score) => {
  const fixture = processFixture(`info depth 0 score ${score}\nbestmove (none)\n`);
  expect(await createStockfish(config, fixture.start).analyze(position)).toMatchObject({ bestMove: null, evaluation: { depth: 0, pv: [] } });
});
it("keeps missing evaluations explicit", async () => {
  const fixture = processFixture("info string hello\nbestmove e2e4\n");
  expect(await createStockfish(config, fixture.start).analyze(fen)).toMatchObject({ evaluation: null });
});
it.each(["info depth 2 score cp nope\n", "info depth 2 score cp 3 pv e2e5\n", "bestmove nonsense\n", "bestmove 0000\n", "bestmove e2e5\n"])("rejects malformed/illegal output and cleans up (%#)", async output => {
  const fixture = processFixture(output);
  await expect(createStockfish(config, fixture.start).analyze(fen)).rejects.toHaveProperty("code", "PROTOCOL");
  expect(fixture.commands).toContain("quit");
  expect(fixture.child.stdout.destroyed).toBe(true);
});
it.each([false, true])("bounds search and initialization, kills an unresponsive process (%#)", async noInit => {
  vi.useFakeTimers();
  const fixture = processFixture("", { hang: true, noQuit: true, noInit });
  const pending = createStockfish(config, fixture.start).analyze(fen);
  const assertion = expect(pending).rejects.toHaveProperty("code", "TIMEOUT");
  await vi.advanceTimersByTimeAsync(5500);
  await assertion;
  expect(fixture.child.kill).toHaveBeenCalledWith("SIGKILL");
  expect(fixture.child.stdout.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("detects an early engine exit", async () => {
  const fixture = processFixture("", { exit: true });
  await expect(createStockfish(config, fixture.start).analyze(fen)).rejects.toHaveProperty("code", "EXITED");
  expect(fixture.child.stdout.destroyed).toBe(true);
});
it("sanitizes spawn errors and cleans up failed processes", async () => {
  const fixture = processFixture("", { noInit: true });
  const pending = createStockfish(config, fixture.start).analyze(fen);
  fixture.child.emit("error", new Error("private executable path"));
  await expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE", message: expect.not.stringContaining("private") });
  expect(fixture.child.stdout.destroyed).toBe(true);
});
it("validates FEN before spawning", async () => {
  const fixture = processFixture();
  await expect(createStockfish(config, fixture.start).analyze(`${fen}\nquit`)).rejects.toHaveProperty("code", "INVALID_FEN");
  expect(fixture.start).not.toHaveBeenCalled();
});
it("retains score bounds, promotions and ignores secondary variations", () => {
  expect(parseInfo("info depth 9 score cp -30 lowerbound pv a7a8q")).toMatchObject({ score: { value: -30, bound: "lower" }, pv: ["a7a8q"] });
  expect(parseInfo("info depth 9 multipv 2 score cp 10 pv e2e4")).toBeNull();
  expect(parseBestMove("bestmove 0000")).toBeNull();
  expect(() => parseInfo("info depth 9 score cp 1 lowerbound upperbound")).toThrow();
});
it.each([
  {}, { STOCKFISH_PATH: "stockfish" }, { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_DEPTH: "0" },
  { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_DEPTH: "31" },
  { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_DEPTH: "1.5" },
  { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_MOVETIME_MS: "-1" },
  { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_MOVETIME_MS: "30000" },
  { STOCKFISH_PATH: "/bin/stockfish", STOCKFISH_TIMEOUT_MS: "NaN" },
])("rejects invalid configuration (%#)", env => expect(() => readEngineConfig(env)).toThrow());
it("force-closes an engine that completes analysis but ignores quit", async () => {
  vi.useFakeTimers();
  const fixture = processFixture(undefined, { noQuit: true });
  const pending = createStockfish(config, fixture.start).analyze(fen);
  await vi.advanceTimersByTimeAsync(300);
  expect(await pending).toHaveProperty("bestMove", "e2e4");
  expect(fixture.child.kill).toHaveBeenCalledWith("SIGKILL");
  expect(vi.getTimerCount()).toBe(0);
});
it("bounds cleanup even when the process never reports close", async () => {
  vi.useFakeTimers();
  const fixture = processFixture("", { noInit: true, noQuit: true });
  fixture.child.kill = vi.fn(() => false);
  const assertion = expect(createStockfish(config, fixture.start).analyze(fen)).rejects.toHaveProperty("code", "TIMEOUT");
  await vi.advanceTimersByTimeAsync(7000);
  await assertion;
  expect(fixture.child.unref).toHaveBeenCalled();
  expect(fixture.child.stdout.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("rejects oversized unterminated output", async () => {
  const fixture = processFixture("", { noInit: true });
  const pending = createStockfish(config, fixture.start).analyze(fen);
  fixture.child.stdout.emit("data", "x".repeat(1_000_001));
  await expect(pending).rejects.toHaveProperty("code", "PROTOCOL");
});
it("sanitizes synchronous spawn failure", async () => {
  await expect(createStockfish(config, () => { throw new Error("private path"); }).analyze(fen)).rejects.toMatchObject({ code: "UNAVAILABLE", message: expect.not.stringContaining("private") });
});
it("cleans up on a stream failure", async () => {
  const fixture = processFixture("", { noInit: true });
  const pending = createStockfish(config, fixture.start).analyze(fen);
  fixture.child.stdout.emit("error", new Error("private pipe error"));
  await expect(pending).rejects.toHaveProperty("code", "UNAVAILABLE");
  expect(fixture.child.stdout.destroyed).toBe(true);
});
it("collects ranked MultiPV lines without replacing the best evaluation with the runner-up", async () => {
  const fixture = processFixture("info depth 14 multipv 1 score cp 250 pv e2e4\ninfo depth 14 multipv 2 score cp 20 pv d2d4\nbestmove e2e4\n");
  const result = await createStockfish({ ...config, multiPv: 2 }, fixture.start).analyze(fen);
  expect(fixture.commands).toContain("setoption name MultiPV value 2");
  expect(result.evaluation?.score.value).toBe(250);
  expect(result.variations?.map(line => line.pv[0])).toEqual(["e2e4", "d2d4"]);
});
it("validates secondary MultiPV continuations too", async () => {
  const fixture = processFixture("info depth 14 multipv 1 score cp 250 pv e2e4\ninfo depth 14 multipv 2 score cp 20 pv d2d5\nbestmove e2e4\n");
  await expect(createStockfish({ ...config, multiPv: 2 }, fixture.start).analyze(fen)).rejects.toHaveProperty("code", "PROTOCOL");
});
it("streams coherent top-three iterations and returns the last complete depth", async () => {
  const fixture = processFixture("info depth 10 multipv 1 score cp 30 pv e2e4 e7e5\ninfo depth 10 multipv 2 score cp 20 pv d2d4 d7d5\ninfo depth 10 multipv 3 score cp 10 pv g1f3 g8f6\ninfo depth 11 multipv 1 score cp 35 pv e2e4 e7e5\nbestmove e2e4\n");
  const progress = vi.fn();
  const result = await createStockfish({ ...config, multiPv: 3 }, fixture.start).analyze(fen, { onProgress: progress });
  expect(result.variations?.map(line => line.depth)).toEqual([10, 10, 10]);
  expect(result.variations?.map(line => line.pv[0])).toEqual(["e2e4", "d2d4", "g1f3"]);
  expect(progress).toHaveBeenCalledTimes(4);
  expect(progress.mock.calls.at(-1)?.[0].variations?.map((line: { depth: number }) => line.depth)).toEqual([11]);
  expect(fixture.commands).toContain("setoption name MultiPV value 3");
});
it("handles fewer legal roots and validates third-ranked continuations", async () => {
  const oneMove = "r7/8/8/8/8/2k5/8/K7 w - - 0 1";
  expect(new Chess(oneMove).moves()).toHaveLength(1);
  const fixture = processFixture("info depth 7 multipv 1 score cp -500 pv a1b1\nbestmove a1b1\n");
  expect((await createStockfish({ ...config, multiPv: 3 }, fixture.start).analyze(oneMove)).variations).toHaveLength(1);
  const bad = processFixture("info depth 7 multipv 1 score cp 30 pv e2e4\ninfo depth 7 multipv 2 score cp 20 pv d2d4\ninfo depth 7 multipv 3 score cp 10 pv g1g4\nbestmove e2e4\n");
  await expect(createStockfish({ ...config, multiPv: 3 }, bad.start).analyze(fen)).rejects.toHaveProperty("code", "PROTOCOL");
});
it("aborts an active process and removes its abort listener after cleanup", async () => {
  const fixture = processFixture("", { hang: true });
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const pending = createStockfish(config, fixture.start).analyze(fen, { signal: controller.signal });
  const assertion = expect(pending).rejects.toHaveProperty("code", "CANCELLED");
  controller.abort(); await assertion;
  expect(fixture.commands).toContain("quit");
  expect(fixture.child.stdout.destroyed).toBe(true);
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  const cancelled = processFixture();
  await expect(createStockfish(config, cancelled.start).analyze(fen, { signal: controller.signal })).rejects.toHaveProperty("code", "CANCELLED");
  expect(cancelled.start).not.toHaveBeenCalled();
});
it("preserves validated move history in the UCI position command", async () => {
  const board = new Chess(); board.move("e4");
  const fixture = processFixture("info depth 12 score cp 10 pv e7e5\nbestmove e7e5\n");
  await createStockfish(config, fixture.start).analyze(board.fen(), { history: { startFen: fen, moves: ["e2e4"] } });
  expect(fixture.commands).toContain(`position fen ${fen} moves e2e4`);
  const invalid = processFixture();
  await expect(createStockfish(config, invalid.start).analyze(board.fen(), { history: { startFen: fen, moves: ["d2d4"] } })).rejects.toHaveProperty("code", "INVALID_FEN");
  expect(invalid.start).not.toHaveBeenCalled();
});
it("keeps final candidates consistent with a changed engine best move", async () => {
  const fixture = processFixture("info depth 10 multipv 1 score cp 30 pv e2e4\ninfo depth 10 multipv 2 score cp 20 pv d2d4\ninfo depth 10 multipv 3 score cp 10 pv g1f3\ninfo depth 11 multipv 1 score cp 35 pv d2d4\nbestmove d2d4\n");
  const result = await createStockfish({ ...config, multiPv: 3 }, fixture.start).analyze(fen);
  expect(result.bestMove).toBe("d2d4"); expect(result.variations?.[0].pv[0]).toBe("d2d4"); expect(result.variations).toHaveLength(1);
});
