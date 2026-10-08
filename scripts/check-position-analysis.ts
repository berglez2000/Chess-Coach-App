import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { createStockfish } from "../lib/engine/stockfish";
import { positionResult, scoreLabel } from "../lib/position-analysis/contract";
async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const config = { path: process.env.STOCKFISH_PATH ?? "", depth: 30, moveTimeMs: 1000, timeoutMs: 6000, multiPv: 3 as const };
  const black = new Chess(); black.move("e4");
  for (const fen of [DEFAULT_POSITION, black.fen(), "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", "r7/8/8/8/8/2k5/8/K7 w - - 0 1", "r7/8/8/8/2k5/8/8/K7 w - - 0 1"]) {
    let updates = 0;
    const output = await createStockfish(config).analyze(fen, { onProgress: () => { updates++; } });
    const result = positionResult(fen, output);
    assert.equal(result.candidates.length, Math.min(3, new Chess(fen).moves().length));
    assert.ok(updates > 0);
    console.log(JSON.stringify({ turn: new Chess(fen).turn(), candidates: result.candidates.map(candidate => ({ move: candidate.moves[0].san, score: scoreLabel(candidate.evaluation), depth: candidate.evaluation.depth })), updates }));
  }
  const controller = new AbortController();
  const pending = createStockfish({ ...config, moveTimeMs: 8000, timeoutMs: 13000 }).analyze(DEFAULT_POSITION, { signal: controller.signal, onProgress: () => controller.abort() });
  await assert.rejects(pending, { code: "CANCELLED" });
  console.log("Live MultiPV analysis and cancellation passed; engine processes closed.");
}
main().catch(() => { console.error("Position analysis check failed. Verify STOCKFISH_PATH and engine availability."); process.exitCode = 1; });
