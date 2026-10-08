import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { createMaia } from "../lib/engine/maia";
import { MAIA_RATINGS } from "../lib/play/contract";

async function main() {
  loadEnvConfig(process.cwd());
  for (const [name, rating] of Object.entries(MAIA_RATINGS)) {
    const board = new Chess(); const moves: string[] = [];
    for (let ply = 0; ply < 2; ply++) {
      const result = await createMaia(process.env.MAIA_PATH ?? "", rating).analyze(board.fen(), { history: { startFen: DEFAULT_POSITION, moves } });
      assert.ok(result.bestMove); assert.equal(result.evaluation, null);
      moves.push(board.move(result.bestMove).lan);
    }
    console.log(`${name} (${rating}): ${board.history().join(" ")} · legal replies verified`);
  }
}
main().catch(() => { console.error("Maia play check failed. Check MAIA_PATH and pre-cache the model for the application account."); process.exitCode = 1; });
