import "server-only";
import { getDb } from "@/lib/db/client";
import { readEngineConfig } from "@/lib/engine/config";
import { createStockfish } from "@/lib/engine/stockfish";
import { analyzeGame } from "./orchestrate";
import { createAnalysisRepository } from "./repository";

export async function analyzeSavedGame(id: string) {
  return analyzeGame(id, createAnalysisRepository(getDb()), () => {
    const config = readEngineConfig(process.env);
    return { engine: createStockfish(config), configuration: {
      engine: "Stockfish", adapterVersion: 1, depth: config.depth,
      moveTimeMs: config.moveTimeMs ?? null, timeoutMs: config.timeoutMs,
      threads: 1, hashMb: 16, multiPv: 1,
    } };
  });
}
