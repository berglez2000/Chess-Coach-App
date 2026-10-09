import { Chess, SQUARES, type PieceSymbol, type Square } from "chess.js";
import type { PuzzleAction, PuzzleState, SolverPuzzle } from "@/types/puzzle";

export type PlacementPiece = "p" | "n" | "b" | "r" | "q";
export const placementNames: Record<PlacementPiece, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" };
export function placedPosition(fen: string, piece: PlacementPiece, square: string, color: "WHITE" | "BLACK") {
  if (!/^[a-h][1-8]$/.test(square) || (piece === "p" && /[18]$/.test(square))) throw new Error("Place the piece on a valid empty square. Pawns cannot be placed on the first or last rank.");
  const board = new Chess(fen);
  if (board.get(square as Square)) throw new Error("Choose an empty square.");
  if (!board.put({ type: piece as PieceSymbol, color: color === "WHITE" ? "w" : "b" }, square as Square)) throw new Error("Could not place this piece.");
  // Placement completes the solver's turn; the opponent must now be in mate.
  const fields = board.fen().split(" "); fields[1] = color === "WHITE" ? "b" : "w"; fields[3] = "-";
  const placed = new Chess(fields.join(" "));
  const king = SQUARES.find(s => placed.get(s)?.type === "k" && placed.get(s)?.color === (color === "WHITE" ? "w" : "b"));
  if (!king || placed.isAttacked(king, color === "WHITE" ? "b" : "w")) throw new Error("The placed piece must leave your king safe.");
  return placed;
}
export type PlacementDefinition = { fen: string; solver: "WHITE" | "BLACK"; placementPiece: PlacementPiece; objective: "MATE" | "SEQUENCE" };
export function applyPlacementAction(content: PlacementDefinition, accepted: string[], saved: PuzzleState, action: PuzzleAction, now = new Date()): PuzzleState {
  const next = { ...saved, revision: saved.revision + 1 };
  if (action.action === "RETRY") return { ...next, state: "SOLVING", playedMoves: [], solvedMove: null, hintUsed: false, assisted: saved.assisted || saved.state !== "SOLVING", lastOutcome: "RETRY" };
  if (saved.state !== "SOLVING") return { ...next, lastOutcome: "FINISHED" };
  if (action.action === "HINT") return { ...next, assisted: true, hintUsed: true, lastOutcome: "HINT" };
  if (action.action === "REVEAL") return { ...next, assisted: true, state: "REVEALED", lastOutcome: "REVEALED" };
  if (action.action !== "MOVE") throw new Error("Unsupported placement action.");
  next.moveAttempts++;
  if (!new RegExp(`^${content.placementPiece}@[a-h][1-8]$`).test(action.move)) return { ...next, lastOutcome: "ILLEGAL" };
  try { placedPosition(content.fen, content.placementPiece, action.move.slice(2), content.solver); }
  catch { return { ...next, lastOutcome: "ILLEGAL" }; }
  const index = accepted.indexOf(action.move);
  if (index < 0) return { ...next, lastOutcome: content.objective === "MATE" ? "INCORRECT" : "UNSUPPORTED" };
  return { ...next, state: "SOLVED", solvedMove: action.move, playedMoves: [action.move], hintUsed: false,
    lastOutcome: index === 0 ? "CORRECT" : "ACCEPTED_ALTERNATIVE", completedAt: saved.completedAt ?? now.toISOString(), completionAssisted: saved.completionAssisted ?? saved.assisted };
}
export function placementDto(id: string, content: PlacementDefinition, accepted: string[], saved: PuzzleState): SolverPuzzle {
  const hintUsed = saved.hintUsed;
  const progress = { revision: saved.revision, state: saved.state, assisted: saved.assisted, playedMoves: saved.playedMoves,
    lastOutcome: saved.lastOutcome, moveAttempts: saved.moveAttempts, completedAt: saved.completedAt, completionAssisted: saved.completionAssisted };
  const exposed = saved.state !== "SOLVING";
  const answer = saved.state === "SOLVED" ? saved.playedMoves[0] : accepted[0];
  const resultingFen = exposed ? placedPosition(content.fen, content.placementPiece, answer.slice(2), content.solver).fen() : content.fen;
  const solution = exposed ? { uci: answer, san: `${content.placementPiece === "p" ? "" : content.placementPiece.toUpperCase()}${answer.slice(2)}${content.objective === "MATE" ? "#" : ""}`, fen: resultingFen } : null;
  return { id, startingFen: content.fen, playerColor: content.solver, gameId: "", sourcePly: 0,
    currentFen: resultingFen, history: saved.state === "SOLVED" && solution ? [solution] : [], maxPlayerMoves: 1, progress,
    hintSquare: hintUsed && !exposed ? accepted[0].slice(2) : null, solution, solutionLine: solution ? [solution] : null,
    goal: exposed ? content.objective === "MATE" ? "mate" : "validated-boundary" : null };
}
