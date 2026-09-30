import { Chess } from "chess.js";

export type Exploration = { startFen: string; moves: string[] };

export function explorationPosition(variation: Exploration) {
  const chess = new Chess(variation.startFen);
  for (const move of variation.moves) chess.move(move);
  return chess;
}

export function exploreMove(variation: Exploration, from: string, to: string, promotion = "q"): Exploration | null {
  const chess = explorationPosition(variation);
  if (chess.isGameOver()) return null;
  try {
    const move = chess.move({ from, to, promotion });
    return { ...variation, moves: [...variation.moves, move.lan] };
  } catch {
    return null;
  }
}

export function explorationFen(variation: Exploration) {
  // Preserve the exact supplied FEN, including an uncapturable en-passant target.
  return variation.moves.length ? explorationPosition(variation).fen() : variation.startFen;
}
