import { expect, it, vi } from "vitest";
import { variationToSan, analyzeGame, type AnalysisRepository } from "@/lib/analysis/orchestrate";
import { Chess } from "chess.js";
it("derives sequential SAN including castling and promotions", () => {
  expect(variationToSan(new Chess().fen(), ["e2e4", "e7e5", "g1f3", "b8c6", "f1e2", "g8f6", "e1g1"])).toEqual(["e4", "e5", "Nf3", "Nc6", "Be2", "Nf6", "O-O"]);
  expect(variationToSan("7k/P7/8/8/8/8/8/7K w - - 0 1", ["a7a8q"])).toEqual(["a8=Q+"]);
  expect(() => variationToSan(new Chess().fen(), ["e2e4", "e7e4"])).toThrow();
});
it("reports failure to persist failure status safely", async () => {
  const repository: AnalysisRepository = { load: vi.fn().mockResolvedValue({ initialFen: new Chess().fen(), moves: [] }), claim: vi.fn().mockResolvedValue(true), save: vi.fn(), complete: vi.fn(), fail: vi.fn().mockRejectedValue(new Error("secret DB")) };
  expect(await analyzeGame("id", repository, () => { throw new Error("secret config"); })).toEqual({ status: "FAILED", code: "STORAGE_FAILED", message: "Could not record analysis status. Check the database connection before retrying." });
});
