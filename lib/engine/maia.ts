import { randomInt } from "node:crypto";
import { isAbsolute } from "node:path";
import type { ChessEngine } from "@/types/engine";
import { EngineError } from "./error";
import { createUciEngine, type StartProcess } from "./uci";

/** Maia predicts human moves; its compatibility scores are never used for analysis. */
export function createMaia(path: string, rating: number, start?: StartProcess): ChessEngine {
  if (!isAbsolute(path) || /[\r\n\0]/.test(path)) throw new EngineError("CONFIG", "Set MAIA_PATH to the absolute path of maia3-5m.");
  if (!Number.isInteger(rating) || rating < 600 || rating > 2600) throw new EngineError("CONFIG", "Maia rating must be an integer from 600 to 2600.");
  return createUciEngine({ path, depth: 1, timeoutMs: 30000 }, {
    name: "Maia", initializationMs: 60000, ignoreEvaluation: true,
    // Fresh seeds matter because each reply starts an isolated engine process.
    args: ["--use-uci-history", "--local-files-only", "--device", "cpu", "--seed", String(randomInt(2147483647))],
    options: [`setoption name Elo value ${rating}`, "setoption name Temperature value 1", "setoption name TopP value 1", "setoption name MultiPV value 1"],
    go: "go nodes 1",
  }, start);
}
