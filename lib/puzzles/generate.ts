import type { ChessEngine } from "@/types/engine";
import type { ChessColor } from "@/types/game";
import { selectCandidates, validatePuzzle, type Candidate, type ValidatedPuzzle } from "./policy";

export interface PuzzleRepository {
  load(id: string): Promise<{ userColor: ChessColor; analysisStatus: string; moves: Candidate[] } | null>;
  claim(id: string): Promise<"CLAIMED" | "COMPLETED" | "BUSY">;
  complete(id: string, puzzles: ValidatedPuzzle[], checked: number): Promise<void>;
  fail(id: string): Promise<void>;
}
export async function generatePuzzles(id: string, repository: PuzzleRepository, engineFactory: () => ChessEngine) {
  let claimed = false;
  try {
    const game = await repository.load(id);
    if (!game) return { status: "NOT_FOUND" as const };
    if (game.analysisStatus === "ENGINE_RUNNING" || !game.moves.length || game.moves.some(move => !move.engineAnalysis)) {
      return { status: "NOT_READY" as const };
    }
    const claim = await repository.claim(id);
    if (claim === "COMPLETED") return { status: "COMPLETED" as const };
    if (claim === "BUSY") return { status: "BUSY" as const };
    claimed = true;
    const candidates = selectCandidates(game.moves, game.userColor);
    const puzzles: ValidatedPuzzle[] = [];
    if (candidates.length) {
      const engine = engineFactory();
      for (const candidate of candidates) {
        const puzzle = validatePuzzle(candidate, await engine.analyze(candidate.fenBefore));
        if (puzzle) puzzles.push(puzzle);
      }
    }
    await repository.complete(id, puzzles, candidates.length);
    return { status: "COMPLETED" as const };
  } catch {
    if (claimed) {
      try { await repository.fail(id); } catch { /* Lease recovery remains available after storage failures. */ }
    }
    return { status: "FAILED" as const };
  }
}
