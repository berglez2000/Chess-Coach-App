import { Chess } from "chess.js";
import type { ChessColor } from "@/types/game";

export type RecordingDraft = {
  version: 1; id: string; moves: string[]; color: ChessColor; rotated: boolean;
  player: string; date: string; result: "*" | "1-0" | "0-1" | "1/2-1/2";
  finished: boolean; savePgn?: string;
};

export function recordingChess(moves: string[]) {
  const chess = new Chess();
  for (const uci of moves) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("Invalid recorded move.");
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  }
  return chess;
}

export type PositionMatch = { kind: "same" } | { kind: "move"; uci: string } |
  { kind: "takeback"; ply: number } | { kind: "mismatch" };

export function matchPosition(moves: string[], placement: string): PositionMatch {
  const chess = recordingChess(moves);
  if (chess.fen().split(" ")[0] === placement) return { kind: "same" };
  const candidates = chess.moves({ verbose: true }).filter(move => move.after.split(" ")[0] === placement);
  if (candidates.length === 1) {
    const move = candidates[0];
    return { kind: "move", uci: move.from + move.to + (move.promotion ?? "") };
  }
  // Latest matching ancestor only; never infer a forward sequence from a final position.
  for (let ply = moves.length - 1; ply >= 0; ply--) {
    chess.undo();
    if (chess.fen().split(" ")[0] === placement) return { kind: "takeback", ply };
  }
  return { kind: "mismatch" };
}

// Pressure boards report the departure press separately from the destination press.
// Keep recording armed while changes fit a single legal move being carried out.
export function isIncompleteMove(moves: string[], placement: string): boolean {
  const expand = (fen: string) => fen.split(" ")[0].replaceAll("/", "").replace(/\d/g, digit => ".".repeat(Number(digit)));
  const chess = recordingChess(moves);
  const before = expand(chess.fen()), actual = expand(placement);
  if (actual.length !== 64 || actual === before) return false;
  return chess.moves({ verbose: true }).some(move => {
    const after = expand(move.after);
    if (actual === after) return false;
    const destination = (8 - Number(move.to[1])) * 8 + move.to.charCodeAt(0) - 97;
    const pawn = move.color === "w" ? "P" : "p";
    return [...actual].every((piece, index) => before[index] === after[index]
      ? piece === before[index]
      : piece === before[index] || piece === after[index] || piece === "." ||
        Boolean(move.promotion && index === destination && piece === pawn));
  });
}

export function reconstructMoves(text: string, placement: string): string[] {
  if (text.length > 100_000) throw new Error("Move text is too long.");
  const chess = new Chess();
  try { chess.loadPgn(text, { strict: true }); }
  catch { throw new Error("Enter legal move text from the normal starting position."); }
  const history = chess.history({ verbose: true });
  if (!history.length || history.length > 2000 || history[0].before !== new Chess().fen()) {
    throw new Error("Enter moves from the normal starting position.");
  }
  if (chess.fen().split(" ")[0] !== placement) {
    throw new Error("Those moves do not reach the position reported by the board.");
  }
  const moves = history.map(move => move.from + move.to + (move.promotion ?? ""));
  recordingChess(moves);
  return moves;
}

export function recordingPgn(draft: RecordingDraft) {
  const chess = recordingChess(draft.moves);
  const clean = (name: string) => name.replace(/["\\\r\n]/g, "").slice(0, 100).trim() || "Player";
  chess.header("Event", "Millennium board recording", "Site", "Chess Coach",
    "Date", draft.date.replaceAll("-", "."), "Round", "?",
    "White", draft.color === "WHITE" ? clean(draft.player) : "The King Performance",
    "Black", draft.color === "BLACK" ? clean(draft.player) : "The King Performance",
    "Result", draft.result);
  return chess.pgn();
}

export function readDraft(text: string): RecordingDraft {
  if (text.length > 100_000) throw new Error("Draft is too large.");
  const draft = JSON.parse(text) as RecordingDraft;
  if (!draft || draft.version !== 1 || typeof draft.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(draft.id) || !Array.isArray(draft.moves) || draft.moves.length > 2000 ||
      !["WHITE", "BLACK"].includes(draft.color) || typeof draft.rotated !== "boolean" ||
      typeof draft.player !== "string" || draft.player.length > 100 ||
      typeof draft.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
      !["*", "1-0", "0-1", "1/2-1/2"].includes(draft.result) || typeof draft.finished !== "boolean") {
    throw new Error("Invalid recording draft.");
  }
  recordingChess(draft.moves);
  if (draft.savePgn !== undefined && (!draft.finished || draft.savePgn !== recordingPgn(draft))) {
    throw new Error("Invalid saved recording snapshot.");
  }
  return draft;
}
