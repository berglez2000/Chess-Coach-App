import "server-only";
import { readEngineConfig } from "./config";
import { createStockfish } from "./stockfish";

export function getEngine() {
  return createStockfish(readEngineConfig(process.env));
}
