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
