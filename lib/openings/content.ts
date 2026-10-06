import { Chess, DEFAULT_POSITION } from "chess.js";
import { z } from "zod";

export const MAX_LINES = 100;
export const MAX_PLIES = 160;
const lineSchema = z.object({ name: z.string().trim().min(1).max(120), moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(1).max(MAX_PLIES) }).strict();
export const openingSchema = z.object({
  name: z.string().trim().min(1).max(200), description: z.string().max(20000),
  color: z.enum(["WHITE", "BLACK"]), startFen: z.string().max(200),
  lines: z.array(lineSchema).max(MAX_LINES),
}).strict();
export type OpeningContent = z.infer<typeof openingSchema>;
export type OpeningLine = OpeningContent["lines"][number];
export const EMPTY_OPENING: OpeningContent = { name: "", description: "", color: "WHITE", startFen: DEFAULT_POSITION, lines: [] };
export class OpeningError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function position(startFen: string, moves: string[] = []) {
  const chess = new Chess(startFen);
  for (const move of moves) chess.move(move);
  return chess;
}
export function validateContent(input: unknown): OpeningContent {
  const parsed = openingSchema.safeParse(input);
  if (!parsed.success) throw new OpeningError("Check the opening title, position, and variations (up to 100 lines, 160 moves per line).");
  const content = parsed.data;
  try {
    const chess = position(content.startFen);
    const waitingKing = chess.board().flat().find(piece => piece?.type === "k" && piece.color !== chess.turn());
    if (!waitingKing || chess.isAttacked(waitingKing.square, chess.turn())) throw new Error("The non-moving king cannot be in check.");
    for (const [right, kingSquare, rookSquare, color] of [
      ["K", "e1", "h1", "w"], ["Q", "e1", "a1", "w"], ["k", "e8", "h8", "b"], ["q", "e8", "a8", "b"],
    ] as const) {
      if (!chess.fen().split(" ")[2].includes(right)) continue;
      if (chess.get(kingSquare)?.type !== "k" || chess.get(kingSquare)?.color !== color || chess.get(rookSquare)?.type !== "r" || chess.get(rookSquare)?.color !== color) throw new Error("Castling rights need the king and rook on their original squares.");
    }
    content.startFen = chess.fen();
  } catch { throw new OpeningError("Enter a legal starting FEN with both kings; the non-moving king cannot be in check and castling rights must match the pieces."); }
  const seen = new Set<string>();
  for (const line of content.lines) {
    const chess = position(content.startFen);
    for (const uci of line.moves) {
      if (chess.isGameOver()) throw new OpeningError(`${line.name}: moves continue after the position has ended.`);
      try { chess.move(uci); } catch { throw new OpeningError(`${line.name}: illegal move ${uci}.`); }
    }
    const key = line.moves.join(" ");
    if (seen.has(key)) throw new OpeningError("Duplicate variations: keep one copy of each move sequence.");
    seen.add(key);
  }
  return content;
}

// FEN clocks do not affect opening identity. chess.js omits uncapturable en-passant targets.
export function positionKey(fen: string) { return position(fen).fen().split(" ").slice(0, 4).join(" "); }
export function matchingPositions(content: OpeningContent) {
  const keys = new Set<string>();
  const custom = positionKey(content.startFen) !== positionKey(DEFAULT_POSITION);
  if (custom) keys.add(positionKey(content.startFen));
  for (const line of content.lines) {
    const chess = position(content.startFen);
    for (const [i, move] of line.moves.slice(0, 40).entries()) {
      chess.move(move);
      // Avoid matching every game through the universal first move or initial position.
      if (custom || i >= 3) keys.add(positionKey(chess.fen()));
    }
  }
  return keys;
}
export function exportPgn(content: OpeningContent) {
  return content.lines.map(line => {
    const chess = position(content.startFen, line.moves);
    chess.setHeader("Event", line.name.replace(/["\\\r\n]/g, " "));
    return chess.pgn();
  }).join("\n\n");
}

/** Read SAN mainlines and recursive annotation variations; comments/NAGs are not authored moves. */
export function importPgn(pgn: string, startFen: string): OpeningLine[] {
  if (!pgn.trim() || pgn.length > 250000) throw new OpeningError("Paste a PGN of up to 250 KB.");
  const games = pgn.trim().split(/\n\s*\n(?=\s*\[)/);
  const lines: OpeningLine[] = [];
  for (const game of games) {
    const fenHeader = game.match(/\[FEN\s+"([^"]+)"\]/i)?.[1];
    if (fenHeader && positionKey(fenHeader) !== positionKey(startFen)) throw new OpeningError("The PGN starting position differs. Set the opening FEN first.");
    const event = game.match(/\[Event\s+"([^"]*)"\]/i)?.[1] || "Imported variation";
    const text = game.replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ").replace(/\$\d+/g, " ").replace(/\d+\.(?:\.\.)?/g, " ");
    const tokens = text.match(/\(|\)|[^\s()]+/g) || [];
    let moves: string[] = [];
    let chess = position(startFen);
    const stack: string[][] = [];
    const collect = () => { if (moves.length) lines.push({ name: `${event.slice(0, 90)} ${lines.length + 1}`, moves: [...moves] }); };
    for (const raw of tokens) {
      if (raw === "(") { if (!moves.length) throw new OpeningError("A PGN branch needs a preceding move."); stack.push(moves); moves = moves.slice(0, -1); chess = position(startFen, moves); continue; }
      if (raw === ")") { collect(); const parent = stack.pop(); if (!parent) throw new OpeningError("Unbalanced PGN branches."); moves = parent; chess = position(startFen, moves); continue; }
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(raw)) { if (!stack.length) { collect(); moves = []; chess = position(startFen); } continue; }
      const token = raw.replace(/[!?]+$/g, "");
      try { moves = [...moves, chess.move(token).lan]; }
      catch { throw new OpeningError(`Cannot import PGN move: ${raw}.`); }
      if (moves.length > MAX_PLIES || lines.length > MAX_LINES) throw new OpeningError("PGN exceeds the variation limits.");
    }
    if (stack.length) throw new OpeningError("Unbalanced PGN branches.");
    collect();
  }
  const unique = lines.filter((line, i) => !lines.slice(0, i).some(other => other.moves.join(" ") === line.moves.join(" ")));
  const leaves = unique.filter(line => !unique.some(other => other.moves.length > line.moves.length && line.moves.every((move, i) => other.moves[i] === move)));
  validateContent({ ...EMPTY_OPENING, name: "Import", startFen, lines: leaves });
  if (!leaves.length) throw new OpeningError("The PGN contains no moves.");
  return leaves;
}

export type PracticeState = { moves: string[]; target: number; assisted: boolean; revealed: boolean };
export function candidates(content: OpeningContent, state: PracticeState) {
  return content.lines.map((line, index) => ({ line, index })).filter(({ line }) => state.moves.every((move, i) => line.moves[i] === move));
}
export function complete(content: OpeningContent, state: PracticeState) { return preferred(content, state)?.line.moves.length === state.moves.length; }
export function preferred(content: OpeningContent, state: PracticeState) { const options = candidates(content, state); return options.find(x => x.index === state.target) ?? options[0]; }
export function autoReply(content: OpeningContent, state: PracticeState): PracticeState {
  const chess = position(content.startFen, state.moves);
  if (complete(content, state) || chess.isGameOver() || chess.turn() === (content.color === "WHITE" ? "w" : "b")) return state;
  const next = preferred(content, state);
  if (!next) return state;
  return { ...state, target: next.index, moves: [...state.moves, next.line.moves[state.moves.length]] };
}
export function practiceMove(content: OpeningContent, state: PracticeState, uci: string): { state: PracticeState; outcome: "CORRECT" | "INCORRECT" | "ILLEGAL" } {
  if (state.revealed || complete(content, state)) return { state, outcome: "ILLEGAL" };
  const chess = position(content.startFen, state.moves);
  if (chess.turn() !== (content.color === "WHITE" ? "w" : "b")) return { state, outcome: "ILLEGAL" };
  try { chess.move(uci); } catch { return { state, outcome: "ILLEGAL" }; }
  const advanced = { ...state, moves: [...state.moves, uci] };
  const next = preferred(content, advanced);
  if (!next) return { state, outcome: "INCORRECT" };
  return { state: { ...advanced, target: next.index }, outcome: "CORRECT" };
}
export function shuffledIndices(length: number, previous?: number, random = Math.random) {
  const values = Array.from({ length }, (_, i) => i);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  if (length > 1 && values[0] === previous) [values[0], values[1]] = [values[1], values[0]];
  return values;
}
