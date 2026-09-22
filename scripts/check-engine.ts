import { loadEnvConfig } from "@next/env";
import { Chess } from "chess.js";
import { getEngine } from "../lib/engine/client";
import { EngineError } from "../lib/engine/error";

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  const result = await getEngine().analyze(new Chess().fen());
  if (!result.bestMove || !result.evaluation) throw new Error("Missing engine analysis");
  console.log(JSON.stringify(result, null, 2));
  console.log("Stockfish smoke test passed; engine process closed.");
}
main().catch(error => {
  console.error(error instanceof EngineError ? `Engine check failed (${error.code}): ${error.message}` : "Engine check failed: expected a legal best move and evaluation.");
  process.exitCode = 1;
});
