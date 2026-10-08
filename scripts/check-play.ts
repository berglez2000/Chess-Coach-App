import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { createStockfish } from "../lib/engine/stockfish";
import { DIFFICULTIES } from "../lib/play/contract";
async function main() {
  loadEnvConfig(process.cwd());
  for (const [name, settings] of Object.entries(DIFFICULTIES)) {
    for (const startFen of [DEFAULT_POSITION, "7k/8/6K1/8/8/8/8/R7 w - - 0 1"]) {
      const board = new Chess(startFen); const moves: string[] = [];
      for (let ply = 0; ply < 2 && !board.isGameOver(); ply++) {
        const result = await createStockfish({ path: process.env.STOCKFISH_PATH ?? "", depth: 30, skillLevel: settings.skillLevel, moveTimeMs: settings.milliseconds, timeoutMs: settings.milliseconds + 5000 }).analyze(board.fen(), { history: { startFen, moves } });
        assert.ok(result.bestMove); const move = board.move(result.bestMove); moves.push(move.lan);
      }
      console.log(`${name}: ${board.history().join(" ")} · legal replies verified`);
    }
  }
}
main().catch(() => { console.error("Stockfish play check failed. Check STOCKFISH_PATH."); process.exitCode = 1; });
