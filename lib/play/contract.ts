import { z } from "zod";
import { readAnalysisRequest } from "@/lib/position-analysis/contract";
export const DIFFICULTIES = {
  easy: { label: "Easy", skillLevel: 0, milliseconds: 250 },
  casual: { label: "Casual", skillLevel: 5, milliseconds: 500 },
  challenging: { label: "Challenging", skillLevel: 10, milliseconds: 1000 },
  strong: { label: "Strong", skillLevel: 20, milliseconds: 2000 },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
const schema = z.object({ startFen: z.string().max(200), moves: z.array(z.string()).max(400), color: z.enum(["WHITE", "BLACK"]), difficulty: z.enum(["easy", "casual", "challenging", "strong"]) }).strict();
export function readPlayRequest(raw: unknown) {
  const input = schema.parse(raw);
  const { board } = readAnalysisRequest({ startFen: input.startFen, moves: input.moves, preset: "quick" });
  if (input.moves.length >= 400 && !board.isGameOver()) throw new Error("Move limit reached.");
  if (!board.isGameOver() && board.turn() === (input.color === "WHITE" ? "w" : "b")) throw new Error("It is the player's turn.");
  return { ...input, board };
}
