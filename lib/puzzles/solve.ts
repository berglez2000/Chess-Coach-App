import { Chess } from "chess.js";
import { z } from "zod";
import type { PuzzleAction, PuzzleState, SolverPuzzle } from "@/types/puzzle";
import type { ChessColor } from "@/types/game";

const base = { requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646) };
export const puzzleActionSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("MOVE"), move: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/) }).strict(),
  z.object({ ...base, action: z.enum(["HINT", "REVEAL", "RETRY"]) }).strict(),
]);
export const INITIAL_PROGRESS: PuzzleState = { revision: 0, state: "SOLVING", assisted: false, hintUsed: false,
  solvedMove: null, lastOutcome: null, moveAttempts: 0, completedAt: null, completionAssisted: null };
export interface PuzzleDefinition {
  id: string; startingFen: string; playerColor: ChessColor; sourcePly: number;
  acceptedMoves: string[]; generation: { gameId: string };
}
function play(fen: string, uci: string) {
  const board = new Chess(fen);
  if (board.isGameOver()) throw new Error("Terminal puzzle position.");
  const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  if (move.from + move.to + (move.promotion ?? "") !== uci) throw new Error("Invalid move coordinates.");
  return { uci, san: move.san, fen: board.fen() };
}

/** Explicit browser DTO: never spread a database puzzle or its solution list. */
export function solverDto(puzzle: PuzzleDefinition, progress: PuzzleState): SolverPuzzle {
  const { hintUsed, solvedMove, ...publicProgress } = progress;
  return { id: puzzle.id, startingFen: puzzle.startingFen, playerColor: puzzle.playerColor,
    gameId: puzzle.generation.gameId, sourcePly: puzzle.sourcePly, progress: publicProgress,
    hintSquare: hintUsed ? puzzle.acceptedMoves[0].slice(0, 2) : null,
    solution: progress.state === "SOLVING" ? null : play(puzzle.startingFen, solvedMove ?? puzzle.acceptedMoves[0]),
  };
}

/** The server calls this with persisted definitions and progress, never client answers. */
export function applyPuzzleAction(puzzle: PuzzleDefinition, saved: PuzzleState, action: PuzzleAction, now = new Date()): PuzzleState {
  const next = { ...saved, revision: saved.revision + 1 };
  if (action.action === "RETRY") {
    return { ...next, state: "SOLVING", solvedMove: null, hintUsed: false,
      assisted: saved.assisted || saved.state !== "SOLVING", lastOutcome: "RETRY" };
  }
  if (saved.state !== "SOLVING") return { ...next, lastOutcome: "FINISHED" };
  if (action.action === "HINT") return { ...next, assisted: true, hintUsed: true, lastOutcome: "HINT" };
  if (action.action === "REVEAL") return { ...next, assisted: true, state: "REVEALED", lastOutcome: "REVEALED" };
  if (action.action !== "MOVE") throw new Error("Unsupported puzzle action.");
  next.moveAttempts++;
  try { play(puzzle.startingFen, action.move); }
  catch { return { ...next, lastOutcome: "ILLEGAL" }; }
  const acceptedIndex = puzzle.acceptedMoves.indexOf(action.move);
  if (acceptedIndex < 0) return { ...next, lastOutcome: "INCORRECT" };
  return { ...next, state: "SOLVED", solvedMove: action.move,
    lastOutcome: acceptedIndex === 0 ? "CORRECT" : "ACCEPTED_ALTERNATIVE",
    completedAt: saved.completedAt ?? now.toISOString(), completionAssisted: saved.completionAssisted ?? saved.assisted };
}
