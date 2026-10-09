import { Chess } from "chess.js";
import { z } from "zod";
import type { EndgamePosition } from "./catalog";

export const snapshotSchema = z.object({
  sessionId: z.string().uuid(), difficulty: z.enum(["easy", "casual", "challenging", "strong"]),
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).max(400),
  resigned: z.boolean(), hintUsed: z.boolean(), analysisUsed: z.boolean(),
}).strict();
export type EndgameSnapshot = z.infer<typeof snapshotSchema>;
export type EndgameProgress = { revision: number; snapshot: EndgameSnapshot | null; completedAt: string | null; completionAssisted: boolean | null; attempts: number };
export const EMPTY_ENDGAME_PROGRESS: EndgameProgress = { revision: 0, snapshot: null, completedAt: null, completionAssisted: null, attempts: 0 };
// Changing a position, solver side or objective requires fresh progress; prose edits do not.
export function endgameVersion(position: EndgamePosition) { return JSON.stringify([position.fen, position.color, position.objective]); }
export function applyEndgameSnapshot(position: EndgamePosition, previous: EndgameProgress, incoming: EndgameSnapshot): EndgameProgress {
  const snapshot = snapshotSchema.parse(incoming);
  const old = previous.snapshot;
  const same = old?.sessionId === snapshot.sessionId;
  if (same && (old.difficulty !== snapshot.difficulty || old.moves.some((move, i) => snapshot.moves[i] !== move) || (old.resigned && !snapshot.resigned))) throw new Error("Saved game cannot be rewritten. Restart for a new attempt.");
  if (!same && snapshot.moves.length) throw new Error("Start a new attempt before playing moves.");
  if (same) { snapshot.hintUsed ||= old.hintUsed; snapshot.analysisUsed ||= old.analysisUsed; }
  const board = new Chess(position.fen);
  for (const move of snapshot.moves) {
    if (board.isGameOver()) throw new Error("The line continues after the game ended.");
    board.move(move);
  }
  if (same && old.resigned && snapshot.moves.length !== old.moves.length) throw new Error("A resigned game cannot continue.");
  const player = position.color === "WHITE" ? "w" : "b";
  const success = !snapshot.resigned && (position.objective === "draw" ? board.isDraw() : board.isCheckmate() && board.turn() !== player);
  return { revision: previous.revision + 1, snapshot, attempts: previous.attempts + (same ? 0 : 1),
    completedAt: previous.completedAt ?? (success ? new Date().toISOString() : null),
    completionAssisted: previous.completionAssisted ?? (success ? snapshot.hintUsed || snapshot.analysisUsed : null) };
}
