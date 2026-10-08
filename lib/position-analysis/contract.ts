import { Chess } from "chess.js";
import { z } from "zod";
import { normalizeEvaluation } from "@/lib/analysis/evaluation";
import type { EngineResult } from "@/types/engine";
import type { NormalizedEvaluation } from "@/types/analysis";

export const SEARCH_PRESETS = {
  quick: { label: "Quick · 1 second", milliseconds: 1000 },
  standard: { label: "Standard · 3 seconds", milliseconds: 3000 },
  deep: { label: "Deep · 8 seconds", milliseconds: 8000 },
} as const;
export type SearchPreset = keyof typeof SEARCH_PRESETS;
export type AnalysisPosition = { startFen: string; moves: string[] };
const schema = z.object({
  startFen: z.string().trim().min(1).max(200),
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).max(400).default([]),
  preset: z.enum(["quick", "standard", "deep"]),
}).strict();

export function validatePosition(fen: string) {
  if (/[\r\n\0]/.test(fen) || fen.trim().split(/\s+/).length !== 6) throw new Error("Enter a valid six-field FEN.");
  const board = new Chess(fen);
  const waitingKing = board.board().flat().find(piece => piece?.type === "k" && piece.color !== board.turn());
  if (!waitingKing || board.isAttacked(waitingKing.square, board.turn())) throw new Error("The non-moving king cannot be in check.");
  for (const [right, kingSquare, rookSquare, color] of [
    ["K", "e1", "h1", "w"], ["Q", "e1", "a1", "w"], ["k", "e8", "h8", "b"], ["q", "e8", "a8", "b"],
  ] as const) {
    if (!board.fen().split(" ")[2].includes(right)) continue;
    if (board.get(kingSquare)?.type !== "k" || board.get(kingSquare)?.color !== color || board.get(rookSquare)?.type !== "r" || board.get(rookSquare)?.color !== color) throw new Error("Castling rights must match the king and rook.");
  }
  return board;
}
export function readAnalysisRequest(raw: unknown) {
  const input = schema.parse(raw);
  const board = validatePosition(input.startFen);
  for (const move of input.moves) {
    // Imported games may continue after an unclaimed repetition/fifty-move draw.
    // Validate legality while replaying; terminal feedback describes the selected position.
    if (board.isCheckmate() || board.isStalemate()) throw new Error("The line continues after the game ended.");
    board.move(move);
  }
  return { ...input, board };
}
export type Candidate = { rank: number; evaluation: NormalizedEvaluation; moves: { uci: string; san: string; label: string }[] };
export type PositionResult = { fen: string; candidates: Candidate[]; terminal: "checkmate" | "stalemate" | "draw" | null; evaluation: NormalizedEvaluation | null };
export type AnalysisEvent = { type: "progress" | "complete"; result: PositionResult } | { type: "error"; message: string };
export function terminalResult(board: Chess): PositionResult | null {
  if (!board.isGameOver()) return null;
  const checkmate = board.isCheckmate();
  return {
    fen: board.fen(), candidates: [], terminal: checkmate ? "checkmate" : board.isStalemate() ? "stalemate" : "draw",
    evaluation: normalizeEvaluation({ perspective: board.turn() === "w" ? "WHITE" : "BLACK", bestMove: null,
      evaluation: { depth: 0, pv: [], score: { kind: checkmate ? "mate" : "cp", value: 0, bound: "exact" } } }, board.fen()),
  };
}
export function positionResult(fen: string, result: EngineResult): PositionResult {
  const roots = new Set<string>();
  const candidates = (result.variations ?? (result.evaluation ? [result.evaluation] : [])).slice(0, 3).map((info, index) => {
    const board = new Chess(fen);
    if (!info.pv.length || roots.has(info.pv[0])) throw new Error("Engine candidates must have distinct legal root moves.");
    roots.add(info.pv[0]);
    const moves = info.pv.slice(0, 24).map(uci => {
      const number = board.fen().split(" ")[5]; const color = board.turn();
      const move = board.move(uci);
      return { uci, san: move.san, label: `${number}${color === "w" ? "." : "…"} ${move.san}` };
    });
    const evaluation = normalizeEvaluation({ ...result, evaluation: info }, fen)!;
    return { rank: index + 1, evaluation, moves };
  });
  if (!candidates.length) throw new Error("Stockfish returned no candidate evaluations. Try again.");
  return { fen, candidates, terminal: null, evaluation: candidates[0].evaluation };
}
export function scoreLabel(evaluation: NormalizedEvaluation): string {
  const { score } = evaluation;
  const bound = score.bound === "lower" ? "≥" : score.bound === "upper" ? "≤" : "";
  return bound + (score.kind === "mate" ? `${score.winner === "WHITE" ? "+" : "−"}M${Math.abs(score.value)}` : `${score.value > 0 ? "+" : ""}${(score.value / 100).toFixed(2)}`);
}
