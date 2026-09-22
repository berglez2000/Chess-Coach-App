import type { EngineInfo } from "@/types/engine";
import { EngineError } from "./error";

export const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
/** Ignore progress/string lines; reject malformed scored lines rather than inventing an evaluation. */
export function parseInfo(line: string): EngineInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info" || tokens[1] === "string" || !tokens.includes("score")) return null;
  const value = (key: string) => tokens[tokens.indexOf(key) + 1];
  if (tokens.includes("multipv") && value("multipv") !== "1") return null;
  const scoreIndex = tokens.indexOf("score");
  const kind = tokens[scoreIndex + 1];
  const raw = tokens[scoreIndex + 2];
  const depth = tokens.includes("depth") ? value("depth") : "";
  if ((kind !== "cp" && kind !== "mate") || !/^-?\d+$/.test(raw ?? "") || !/^\d+$/.test(depth ?? "") || !Number.isSafeInteger(Number(raw)) || !Number.isSafeInteger(Number(depth))) {
    throw new EngineError("PROTOCOL", "Stockfish returned an invalid evaluation.");
  }
  if (tokens.includes("lowerbound") && tokens.includes("upperbound")) throw new EngineError("PROTOCOL", "Stockfish returned conflicting score bounds.");
  const pv = tokens.includes("pv") ? tokens.slice(tokens.indexOf("pv") + 1) : [];
  if (pv.some(move => !UCI_MOVE.test(move))) throw new EngineError("PROTOCOL", "Stockfish returned an invalid principal variation.");
  return { depth: Number(depth), score: { kind, value: Number(raw), bound: tokens.includes("lowerbound") ? "lower" : tokens.includes("upperbound") ? "upper" : "exact" }, pv };
}
export function parseBestMove(line: string): string | null {
  const match = /^bestmove ([a-h][1-8][a-h][1-8][qrbn]?|0000|\(none\))(?: ponder [a-h][1-8][a-h][1-8][qrbn]?)?$/.exec(line);
  if (!match) throw new EngineError("PROTOCOL", "Stockfish returned an invalid best move.");
  return match[1] === "0000" || match[1] === "(none)" ? null : match[1];
}
