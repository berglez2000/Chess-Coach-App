import { isAbsolute } from "node:path";
import { EngineError } from "./error";

export interface EngineConfig {
  path: string;
  depth: number;
  moveTimeMs?: number;
  timeoutMs: number;
  multiPv?: 1 | 2 | 3;
  skillLevel?: number;
}
export function validateEngineConfig(config: EngineConfig): EngineConfig {
  if (config.skillLevel !== undefined && (!Number.isInteger(config.skillLevel) || config.skillLevel < 0 || config.skillLevel > 20)) throw new EngineError("CONFIG", "Skill level must be an integer from 0 to 20.");
  if (config.multiPv !== undefined && config.multiPv !== 1 && config.multiPv !== 2 && config.multiPv !== 3) throw new EngineError("CONFIG", "MultiPV must be 1, 2, or 3.");
  if (!config.path || !isAbsolute(config.path) || /[\r\n\0]/.test(config.path)) {
    throw new EngineError("CONFIG", "Set STOCKFISH_PATH to the absolute path of the Stockfish executable.");
  }
  for (const [name, value, min, max] of [
    ["depth", config.depth, 1, 30], ["timeout", config.timeoutMs, 100, 120_000],
    ["move time", config.moveTimeMs ?? 100, 10, 30_000],
  ] as const) {
    if (!Number.isInteger(value) || value < min || value > max) throw new EngineError("CONFIG", `Stockfish ${name} must be an integer from ${min} to ${max}.`);
  }
  if (config.moveTimeMs !== undefined && config.timeoutMs <= config.moveTimeMs) throw new EngineError("CONFIG", "Stockfish timeout must exceed move time.");
  return { ...config };
}
export function readEngineConfig(env: Record<string, string | undefined>): EngineConfig {
  return validateEngineConfig({
    path: env.STOCKFISH_PATH ?? "",
    depth: Number(env.STOCKFISH_DEPTH || 12),
    moveTimeMs: env.STOCKFISH_MOVETIME_MS ? Number(env.STOCKFISH_MOVETIME_MS) : undefined,
    timeoutMs: Number(env.STOCKFISH_TIMEOUT_MS || 30_000),
  });
}
