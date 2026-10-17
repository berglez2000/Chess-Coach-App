import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import type { ChessColor } from "@/types/game";

const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE_NAMES: Record<PieceSymbol, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const FILES = "abcdefgh";

export interface Material {
  /** Total piece value (P=1, N=B=3, R=5, Q=9). */
  points: number;
  /** Piece counts, e.g. "Q, 2R, B, N, 6P". */
  summary: string;
}

export interface LoosePiece {
  square: Square;
  piece: string;
  /** "undefended" = attacked and not defended; "attacked by a cheaper piece" = can be won even if defended. */
  reason: "undefended" | "attacked by a cheaper piece";
}

export interface KingSafety {
  square: Square;
  castled: boolean;
  /** Own pawns on the three files around the king, one or two ranks in front of it. */
  pawnShield: number;
  /** Files next to or on the king's file with no pawns of the king's side. */
  openFilesNearKing: string[];
  /** Enemy-attacked squares adjacent to the king. */
  attackedSquaresAroundKing: number;
  inCheck: boolean;
}

export interface SideFeatures {
  material: Material;
  /** Pieces of this side the opponent could win. */
  loosePieces: LoosePiece[];
  king: KingSafety | null;
}

export interface PositionFeatures {
  white: SideFeatures;
  black: SideFeatures;
  /** White points minus Black points. */
  materialBalance: number;
}

const opposite = (c: Color): Color => (c === "w" ? "b" : "w");

function materialFor(chess: Chess, color: Color): Material {
  const counts: Partial<Record<PieceSymbol, number>> = {};
  let points = 0;
  for (const row of chess.board()) for (const cell of row) {
    if (!cell || cell.color !== color) continue;
    counts[cell.type] = (counts[cell.type] ?? 0) + 1;
    points += PIECE_VALUES[cell.type];
  }
  const order: PieceSymbol[] = ["q", "r", "b", "n", "p"];
  const summary = order.filter(t => counts[t]).map(t => `${counts[t]! > 1 ? counts[t] : ""}${t.toUpperCase()}`).join(", ") || "king only";
  return { points, summary };
}

function loosePiecesFor(chess: Chess, color: Color): LoosePiece[] {
  const enemy = opposite(color);
  const result: LoosePiece[] = [];
  for (const row of chess.board()) for (const cell of row) {
    if (!cell || cell.color !== color || cell.type === "k") continue;
    const attackers = chess.attackers(cell.square, enemy);
    if (attackers.length === 0) continue;
    const defenders = chess.attackers(cell.square, color);
    const cheapest = Math.min(...attackers.map(sq => PIECE_VALUES[chess.get(sq)!.type] || 100));
    const piece = `${PIECE_NAMES[cell.type]} on ${cell.square}`;
    if (defenders.length === 0) result.push({ square: cell.square, piece, reason: "undefended" });
    else if (cheapest < PIECE_VALUES[cell.type]) result.push({ square: cell.square, piece, reason: "attacked by a cheaper piece" });
  }
  return result;
}

function kingSafetyFor(chess: Chess, color: Color): KingSafety | null {
  const square = chess.findPiece({ type: "k", color })[0];
  if (!square) return null;
  const enemy = opposite(color);
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const forward = color === "w" ? 1 : -1;
  const homeRank = color === "w" ? 1 : 8;
  const castled = rank === homeRank && (file >= 6 || file <= 2);

  let pawnShield = 0;
  const openFilesNearKing: string[] = [];
  let attackedSquaresAroundKing = 0;
  for (let f = file - 1; f <= file + 1; f++) {
    if (f < 0 || f > 7) continue;
    for (const step of [1, 2]) {
      const r = rank + forward * step;
      if (r < 1 || r > 8) continue;
      const piece = chess.get(`${FILES[f]}${r}` as Square);
      if (piece?.type === "p" && piece.color === color) pawnShield++;
    }
    let ownPawn = false;
    for (let r = 1; r <= 8; r++) {
      const piece = chess.get(`${FILES[f]}${r}` as Square);
      if (piece?.type === "p" && piece.color === color) ownPawn = true;
    }
    if (!ownPawn) openFilesNearKing.push(FILES[f]);
    for (let r = rank - 1; r <= rank + 1; r++) {
      if (r < 1 || r > 8 || (f === file && r === rank)) continue;
      if (chess.isAttacked(`${FILES[f]}${r}` as Square, enemy)) attackedSquaresAroundKing++;
    }
  }
  const inCheck = chess.isAttacked(square, enemy);
  return { square, castled, pawnShield, openFilesNearKing, attackedSquaresAroundKing, inCheck };
}

/** Pure — static, engine-free features of a position. Returns null for an unparseable FEN. */
export function extractPositionFeatures(fen: string): PositionFeatures | null {
  let chess: Chess;
  try { chess = new Chess(fen); } catch { return null; }
  const side = (color: Color): SideFeatures => ({
    material: materialFor(chess, color),
    loosePieces: loosePiecesFor(chess, color),
    king: kingSafetyFor(chess, color),
  });
  const white = side("w");
  const black = side("b");
  return { white, black, materialBalance: white.material.points - black.material.points };
}

function describeKing(label: string, king: KingSafety | null): string {
  if (!king) return `${label} king: not found`;
  const parts = [`on ${king.square}`, king.castled ? "castled" : "not castled", `pawn shield ${king.pawnShield}`];
  if (king.openFilesNearKing.length > 0) parts.push(`no own pawns on ${king.openFilesNearKing.join("/")}-file${king.openFilesNearKing.length > 1 ? "s" : ""}`);
  if (king.attackedSquaresAroundKing > 0) parts.push(`${king.attackedSquaresAroundKing} adjacent square${king.attackedSquaresAroundKing > 1 ? "s" : ""} attacked`);
  if (king.inCheck) parts.push("in check");
  return `${label} king: ${parts.join(", ")}`;
}

function describeLoose(label: string, pieces: LoosePiece[]): string {
  if (pieces.length === 0) return `${label} loose pieces: none`;
  return `${label} loose pieces: ${pieces.map(p => `${p.piece} (${p.reason})`).join("; ")}`;
}

/** Prompt lines describing a position from the mover's point of view. */
export function describePositionFeatures(features: PositionFeatures, mover: ChessColor): string[] {
  const own = mover === "WHITE" ? features.white : features.black;
  const other = mover === "WHITE" ? features.black : features.white;
  const balance = mover === "WHITE" ? features.materialBalance : -features.materialBalance;
  const balanceText = balance === 0 ? "material is level" : `mover is ${balance > 0 ? "up" : "down"} ${Math.abs(balance)} point${Math.abs(balance) > 1 ? "s" : ""}`;
  return [
    `Material: mover ${own.material.summary} (${own.material.points}) vs opponent ${other.material.summary} (${other.material.points}) — ${balanceText}`,
    describeLoose("Mover's", own.loosePieces),
    describeLoose("Opponent's", other.loosePieces),
    describeKing("Mover's", own.king),
    describeKing("Opponent's", other.king),
  ];
}
