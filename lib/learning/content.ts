import { Chess, SQUARES } from "chess.js";
import { z } from "zod";
import type { PuzzleSolution } from "@/types/puzzle";
import { playUci, readSolution } from "@/lib/puzzles/sequence";

import { placedPosition } from "./placement";

export const contentSchema = z.object({
  type: z.enum(["MOVE", "MISSING_PIECE"]).default("MOVE"),
  placementPiece: z.enum(["p", "n", "b", "r", "q"]).default("n"),
  fen: z.string().max(200).default(""), solver: z.enum(["WHITE", "BLACK"]).default("WHITE"),
  prompt: z.string().max(2000).default(""), objective: z.enum(["MATE", "SEQUENCE"]).default("MATE"),
  mateIn: z.number().int().min(1).max(4).default(1),
  solutionText: z.string().max(10000).default(""), hint: z.string().max(2000).default(""),
  explanation: z.string().max(5000).default(""),
  diagramPage: z.string().max(80).default(""), answerPage: z.string().max(80).default(""),
  pdfId: z.string().max(100).default(""), pdfPage: z.number().int().min(1).max(10000).nullable().default(null),
}).strict();
export type LearningContent = z.infer<typeof contentSchema>;
export const SAMPLE_CONTENT: LearningContent = contentSchema.parse({
  fen: "kr6/1p6/p7/4b3/8/8/1P4BP/R6K w - - 0 1", prompt: "White to move and mate in one.",
  solutionText: "Rxa6#", explanation: "The bishop on g2 pins the b7 pawn to the king on a8, so the pawn cannot capture the rook on a6.",
});
export type Validation = { method: string; nodes: number; solution: PuzzleSolution; acceptedMoves: string[]; fingerprint: string };
export class LearningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function answerIdentity(content: LearningContent) {
  // Provenance is presentation metadata; hints/explanations can expose answers and belong to the pinned revision.
  return JSON.stringify([content.type, content.fen, content.solver, content.prompt, content.objective, content.mateIn,
    content.solutionText, content.hint, content.explanation, ...(content.type === "MISSING_PIECE" ? [content.placementPiece] : [])]);
}
function position(content: LearningContent) {
  let board: Chess;
  try { board = new Chess(content.fen); } catch { throw new LearningError("Enter a valid full FEN before validating."); }
  if (board.turn() !== (content.solver === "WHITE" ? "w" : "b")) throw new LearningError("Side to move must match the solver.");
  const opponent = board.turn() === "w" ? "b" : "w";
  const king = SQUARES.find(square => board.get(square)?.type === "k" && board.get(square)?.color === opponent)!;
  if (board.isAttacked(king, board.turn())) throw new LearningError("The side that just moved cannot already be in check.");
  for (const color of ["w", "b"] as const) {
    const pieces = SQUARES.map(square => board.get(square)).filter(piece => piece?.color === color);
    if (pieces.length > 16 || pieces.filter(piece => piece?.type === "p").length > 8) throw new LearningError("The position has too many pieces or pawns for one side.");
  }
  const rights = content.fen.split(" ")[2];
  for (const [right, kingSquare, rookSquare, color] of [["K","e1","h1","w"],["Q","e1","a1","w"],["k","e8","h8","b"],["q","e8","a8","b"]] as const) {
    if (rights.includes(right) && (board.get(kingSquare)?.type !== "k" || board.get(kingSquare)?.color !== color || board.get(rookSquare)?.type !== "r" || board.get(rookSquare)?.color !== color)) throw new LearningError("Castling rights require the corresponding king and rook on their original squares.");
  }
  const ep = content.fen.split(" ")[3];
  if (ep !== "-") {
    const pawnSquare = (ep[0] + (board.turn() === "w" ? "5" : "4")) as Parameters<Chess["get"]>[0];
    if (board.get(ep as Parameters<Chess["get"]>[0]) || board.get(pawnSquare)?.type !== "p" || board.get(pawnSquare)?.color !== opponent) throw new LearningError("En passant requires an empty target square and the opponent pawn behind it.");
  }
  if (board.isGameOver()) throw new LearningError("The starting position is already terminal.");
  return board;
}
export function sanLines(content: LearningContent) {
  if (!content.solutionText.trim()) throw new LearningError("Enter at least one solution line, one branch per line.");
  return content.solutionText.trim().split(/\n+/).map(text => {
    const board = position(content);
    const moves: string[] = [];
    for (const token of text.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/)) {
      try {
        const move = board.move(token, { strict: true });
        moves.push(move.from + move.to + (move.promotion ?? ""));
      } catch { throw new LearningError(`Invalid solution move: ${token}. Use SAN, with one branch per line.`); }
    }
    if (!moves.length || moves.length > 7 || moves.length % 2 !== 1) throw new LearningError("A solution must end on a solver move and contain at most seven half-moves.");
    if (content.objective === "MATE" && (!board.isCheckmate() || Math.ceil(moves.length / 2) > content.mateIn)) {
      throw new LearningError("Every published mating line must reach checkmate within the declared move bound.");
    }
    return { moves, goal: board.isCheckmate() ? "mate" as const : board.isGameOver() ? "terminal" as const : "validated-boundary" as const };
  });
}

/** Exhaustive bounded AND/OR proof. No PV, prose, or cooperative line is treated as forced mate. */
export function validateContent(raw: unknown, limits = { nodes: 100000, milliseconds: 5000 }): Validation {
  const content = contentSchema.parse(raw);
  if (content.type === "MISSING_PIECE") return validatePlacement(content);
  const board = position(content);
  const authored = sanLines(content);
  const roots = [...new Set(authored.map(line => line.moves[0]))];
  try { readSolution({ version: 2, maxPlayerMoves: 4, lines: authored }, content.fen, roots, content.solver); }
  catch (error) { throw new LearningError(error instanceof Error ? error.message : "Invalid solution branches."); }
  if (content.objective === "SEQUENCE") return { method: "legal-authored-sequence-v1", nodes: 0,
    solution: { version: 2, maxPlayerMoves: 4, lines: authored }, acceptedMoves: roots, fingerprint: answerIdentity(content) };
  const solver = board.turn();
  const deadline = Date.now() + limits.milliseconds;
  let nodes = 0;
  const memo = new Map<string, boolean>();
  function budget() {
    if (++nodes > limits.nodes || Date.now() > deadline) throw new LearningError("Mate verification reached its search limit. The draft is saved; reduce the move bound or simplify the position before publishing.");
  }
  function forced(plies: number): boolean {
    budget();
    if (plies <= 0) return board.turn() !== solver && board.isCheckmate();
    const key = `${board.fen()}|${plies}`;
    const cached = memo.get(key); if (cached !== undefined) return cached;
    const legal = board.moves({ verbose: true });
    if (!legal.length) return board.isCheck() && board.turn() !== solver;
    if (board.isDrawByFiftyMoves() || board.isInsufficientMaterial() || board.isThreefoldRepetition()) return false;
    const attacker = board.turn() === solver;
    // Checks first improves proof discovery without omitting any defensive move.
    if (attacker) legal.sort((a, b) => Number(b.san.endsWith("#")) - Number(a.san.endsWith("#")) || Number(b.san.endsWith("+")) - Number(a.san.endsWith("+")));
    let result = !attacker;
    for (const move of legal) {
      board.move(move); const wins = forced(plies - 1); board.undo();
      if (attacker ? wins : !wins) { result = attacker; break; }
    }
    memo.set(key, result); return result;
  }
  const preferred = new Map<string, string>();
  for (const line of authored) for (let i = 1; i < line.moves.length; i += 2) preferred.set(line.moves.slice(0, i).join(" "), line.moves[i]);
  const lines: PuzzleSolution["lines"] = [];
  function collect(plies: number, prefix: string[]) {
    budget();
    if (board.isCheckmate()) {
      if (lines.length >= 1024) throw new LearningError("Too many accepted branches to publish. Reduce the move bound.");
      lines.push({ moves: prefix, goal: "mate" }); return;
    }
    const legal = board.moves({ verbose: true }).sort((a,b) => a.lan.localeCompare(b.lan));
    if (board.turn() !== solver) {
      const selected = legal.find(move => move.lan === preferred.get(prefix.join(" "))) ?? legal[0];
      board.move(selected); collect(plies - 1, [...prefix, selected.lan]); board.undo(); return;
    }
    for (const move of legal) {
      board.move(move);
      if (forced(plies - 1)) collect(plies - 1, [...prefix, move.lan]);
      board.undo();
    }
  }
  const maxPlies = content.mateIn * 2 - 1;
  if (!forced(maxPlies)) throw new LearningError("This position does not force mate within the declared move bound.");
  // Check each book move at its actual position, including sidelines not selected for practice.
  for (const line of authored) {
    for (let i = 0; i < line.moves.length; i++) {
      playUci(board, line.moves[i]);
      if (i % 2 === 0 && !forced(maxPlies - i - 1)) throw new LearningError("A published solver move does not force mate against every defense.");
    }
    for (let i = 0; i < line.moves.length; i++) board.undo();
  }
  collect(maxPlies, []);
  const acceptedMoves = [...new Set(lines.map(line => line.moves[0]))];
  readSolution({ version: 2, maxPlayerMoves: 4, lines }, content.fen, acceptedMoves, content.solver);
  return { method: "exhaustive-forced-mate-v1", nodes, solution: { version: 2, maxPlayerMoves: 4, lines }, acceptedMoves, fingerprint: answerIdentity(content) };
}

function validatePlacement(content: LearningContent): Validation {
  let board: Chess;
  try { board = new Chess(content.fen); } catch { throw new LearningError("Enter a valid full FEN before validating."); }
  if (board.turn() !== (content.solver === "WHITE" ? "w" : "b")) throw new LearningError("Side to move must match the solver.");
  const piece = content.placementPiece;
  const symbol = piece === "p" ? "" : piece.toUpperCase();
  const answers = content.solutionText.trim().split(/\n+/).map(line => {
    const match = line.trim().match(new RegExp(`^(?:1\\.\\s*)?${symbol}([a-h][1-8])([+#]?)$`));
    if (!match) throw new LearningError(`Enter a placement such as ${symbol}g6${content.objective === "MATE" ? "#" : ""}, one per line.`);
    try {
      const placed = placedPosition(content.fen, piece, match[1], content.solver);
      if (content.objective === "MATE" && !placed.isCheckmate()) throw new Error("The placement does not create checkmate.");
      if (match[2] === "#" && !placed.isCheckmate()) throw new Error("The supplied checkmate suffix is incorrect.");
      if (match[2] === "+" && !placed.isCheck()) throw new Error("The supplied check suffix is incorrect.");
    } catch (error) { throw new LearningError(error instanceof Error ? error.message : "Invalid placement."); }
    return `${piece}@${match[1]}`;
  });
  const accepted = [...new Set(answers)];
  if (content.objective === "MATE") for (const square of SQUARES) {
    try { if (placedPosition(content.fen, piece, square, content.solver).isCheckmate() && !accepted.includes(`${piece}@${square}`)) accepted.push(`${piece}@${square}`); } catch { /* occupied or invalid square */ }
  }
  return { method: content.objective === "MATE" ? "exhaustive-placement-mate-v1" : "authored-placement-v1", nodes: content.objective === "MATE" ? 64 : answers.length,
    acceptedMoves: accepted, solution: { version: 2, maxPlayerMoves: 4, lines: [] }, fingerprint: answerIdentity(content) };
}
