import { readFile, writeFile } from "node:fs/promises";
import { Chess } from "chess.js";
import { contentSchema, answerIdentity, type Validation } from "../lib/learning/content";

import { proveAuthoredMate } from "./authored-mate-proof";

async function main() {
  const entries = JSON.parse(await readFile(new URL("../data/learning/mate-in-four.json", import.meta.url), "utf8")) as {
    number: string; content: unknown; bookLines: string[]; analysisLines?: string[];
  }[];
  const cachePath = "/tmp/mate-four-validation.json";
  let checks: Record<string, Validation> = {};
  try { checks = JSON.parse(await readFile(cachePath, "utf8")); } catch { /* Start a new offline cache. */ }
  for (const row of entries) {
    try {
      const content = contentSchema.parse(row.content);
      for (const line of [...row.bookLines, ...(row.analysisLines ?? [])]) {
        const board = new Chess(content.fen);
        for (const token of line.split(" ")) {
          const move = board.move(token, { strict: true });
          if (move.san !== token) throw new Error(`Expected ${move.san}, received ${token}.`);
        }
      }
      if (checks[row.number]?.fingerprint === answerIdentity(content)) {
        console.log(row.number, "CACHED");
        continue;
      }
      checks[row.number] = proveAuthoredMate(content, row.bookLines);
      await writeFile(cachePath, JSON.stringify(checks));
      console.log(row.number, "OK", checks[row.number].nodes);
    } catch (error) {
      console.error(row.number, "FAIL", error instanceof Error ? error.message : "Verification failed.");
      process.exitCode = 1;
    }
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Verification failed."); process.exitCode = 1; });
