import { z } from "zod";
import type { PuzzleAction, PuzzleState, SolverPuzzle } from "@/types/puzzle";
import type { ChessColor } from "@/types/game";
import { playUci, readSolution, replay } from "./sequence";

const base = { requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646) };
export const puzzleActionSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("MOVE"), move: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/) }).strict(),
  z.object({ ...base, action: z.enum(["HINT", "REVEAL", "RETRY"]) }).strict(),
]);
export const INITIAL_PROGRESS: PuzzleState = { revision: 0, state: "SOLVING", assisted: false, hintUsed: false,
  solvedMove: null, playedMoves: [], lastOutcome: null, moveAttempts: 0, completedAt: null, completionAssisted: null };
export interface PuzzleDefinition {
  id: string; startingFen: string; playerColor: ChessColor; sourcePly: number;
  acceptedMoves: string[]; generation: { gameId: string };
  solution?: unknown;
}
function lines(puzzle: PuzzleDefinition) {
  return readSolution(puzzle.solution, puzzle.startingFen, puzzle.acceptedMoves, puzzle.playerColor)?.lines ??
    puzzle.acceptedMoves.map(move => ({ moves: [move], goal: "validated-boundary" as const }));
}
function matching(puzzle: PuzzleDefinition, played: string[]) {
  const matches = lines(puzzle).filter(line => played.every((move, index) => line.moves[index] === move));
  if (!matches.length) throw new Error("Saved progress does not match a solution branch.");
  return matches;
}
function playedMoves(progress: PuzzleState) {
  // Existing completed policy-v1 puzzles have no sequence history yet.
  return progress.playedMoves.length ? progress.playedMoves : progress.state === "SOLVED" && progress.solvedMove ? [progress.solvedMove] : [];
}

/** Explicit browser DTO: never spread a database puzzle or its solution list. */
export function solverDto(puzzle: PuzzleDefinition, progress: PuzzleState): SolverPuzzle {
  const publicProgress = { revision: progress.revision, state: progress.state, assisted: progress.assisted,
    playedMoves: progress.playedMoves, lastOutcome: progress.lastOutcome, moveAttempts: progress.moveAttempts,
    completedAt: progress.completedAt, completionAssisted: progress.completionAssisted };
  const played = playedMoves(progress);
  const branches = matching(puzzle, played);
  const current = replay(puzzle.startingFen, played);
  const exposed = progress.state === "SOLVING" ? null : replay(puzzle.startingFen, branches[0].moves).history;
  return { id: puzzle.id, startingFen: puzzle.startingFen, playerColor: puzzle.playerColor,
    gameId: puzzle.generation.gameId, sourcePly: puzzle.sourcePly, progress: publicProgress,
    currentFen: current.board.fen(), history: current.history,
    maxPlayerMoves: Math.max(...lines(puzzle).map(line => Math.ceil(line.moves.length / 2))),
    hintSquare: progress.hintUsed && progress.state === "SOLVING" ? branches[0].moves[played.length]?.slice(0, 2) ?? null : null,
    solution: exposed?.[0] ?? null, solutionLine: exposed,
    goal: exposed ? branches[0].goal : null,
  };
}

/** The server calls this with persisted definitions and progress, never client answers. */
export function applyPuzzleAction(puzzle: PuzzleDefinition, saved: PuzzleState, action: PuzzleAction, now = new Date()): PuzzleState {
  const next = { ...saved, revision: saved.revision + 1 };
  if (action.action === "RETRY") {
    return { ...next, state: "SOLVING", solvedMove: null, playedMoves: [], hintUsed: false,
      assisted: saved.assisted || saved.state !== "SOLVING", lastOutcome: "RETRY" };
  }
  if (saved.state !== "SOLVING") return { ...next, lastOutcome: "FINISHED" };
  if (action.action === "HINT") return { ...next, assisted: true, hintUsed: true, lastOutcome: "HINT" };
  if (action.action === "REVEAL") return { ...next, assisted: true, state: "REVEALED", lastOutcome: "REVEALED" };
  if (action.action !== "MOVE") throw new Error("Unsupported puzzle action.");
  next.moveAttempts++;
  const played = playedMoves(saved);
  const branches = matching(puzzle, played);
  const { board } = replay(puzzle.startingFen, played);
  try { playUci(board, action.move); }
  catch { return { ...next, lastOutcome: "ILLEGAL" }; }
  const accepted = [...new Set(branches.map(line => line.moves[played.length]))];
  const acceptedIndex = accepted.indexOf(action.move);
  if (acceptedIndex < 0) return { ...next, lastOutcome: "INCORRECT" };
  const branch = branches.find(line => line.moves[played.length] === action.move)!;
  const history = [...played, action.move];
  if (branch.moves.length > history.length) {
    const reply = branch.moves[history.length];
    playUci(board, reply);
    history.push(reply);
    return { ...next, playedMoves: history, hintUsed: false,
      lastOutcome: acceptedIndex === 0 ? "CONTINUE" : "ALTERNATIVE_CONTINUE" };
  }
  return { ...next, state: "SOLVED", solvedMove: history[0], playedMoves: history, hintUsed: false,
    lastOutcome: acceptedIndex === 0 ? "CORRECT" : "ACCEPTED_ALTERNATIVE",
    completedAt: saved.completedAt ?? now.toISOString(), completionAssisted: saved.completionAssisted ?? saved.assisted };
}
