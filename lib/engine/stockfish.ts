import type { ChessEngine } from "@/types/engine";
import { validateEngineConfig, type EngineConfig } from "./config";
import { createUciEngine, type StartProcess } from "./uci";

export function createStockfish(config: EngineConfig, start?: StartProcess): ChessEngine {
  const settings = validateEngineConfig(config);
  return createUciEngine(settings, {
    name: "Stockfish", initializationMs: 5000,
    options: ["setoption name Threads value 1", "setoption name Hash value 16", `setoption name MultiPV value ${settings.multiPv ?? 1}`,
      ...(settings.skillLevel === undefined ? [] : [`setoption name Skill Level value ${settings.skillLevel}`])],
    go: settings.moveTimeMs === undefined ? `go depth ${settings.depth}` : `go movetime ${settings.moveTimeMs}`,
  }, start);
}
