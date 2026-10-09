import type { Chess } from "chess.js";
import importedPawnPositions from "./data/king-and-pawn.json";

export type EndgamePosition = {
  id: string;
  title: string;
  topic: string;
  fen: string;
  color: "WHITE" | "BLACK";
  objective: "mate" | "draw";
  description: string;
  hint: string;
  subtopic?: string;
  source?: { name: string; url: string; revision: string; category: string; group: string; position: number; target: string; license: string; upstreamDatabase: string };
  validation?: { service: string; checkedAt: string; category: string; dtz: number | null; dtm: number | null; fen: string };
};

// Original teaching setups, independent of the user's book exercises.
export const ENDGAMES: EndgamePosition[] = [
  { id: "queen-white", title: "King and queen", topic: "Basic checkmates", fen: "7k/8/8/8/8/2K5/3Q4/8 w - - 0 1", color: "WHITE", objective: "mate", description: "Checkmate the lone king. Bring your king closer and avoid stalemate.", hint: "Use the queen to restrict the king, then bring your king in to support the final check." },
  { id: "rook-white", title: "King and rook", topic: "Basic checkmates", fen: "7k/8/8/8/8/2K5/3R4/8 w - - 0 1", color: "WHITE", objective: "mate", description: "Checkmate with king and rook. Coordinate both pieces to drive the king to an edge.", hint: "Cut off a rank or file with your rook. Advance your king before making the box smaller." },
  { id: "queen-black", title: "King and queen as Black", topic: "Basic checkmates", fen: "8/3q4/2k5/8/8/8/8/7K b - - 0 1", color: "BLACK", objective: "mate", description: "Practice the same mating technique from Black's side.", hint: "Leave the defending king a legal move until you are ready to deliver checkmate." },
  { id: "pawn-white", title: "Convert an advanced pawn", topic: "King and pawn", fen: "8/4P1k1/4K3/8/8/8/8/8 w - - 0 1", color: "WHITE", objective: "mate", description: "Promote your pawn, then finish the game with checkmate. Promotion alone does not complete the objective.", hint: "Your king protects the pawn. After promotion, use your new piece and king together." },
  { id: "pawn-black", title: "Convert as Black", topic: "King and pawn", fen: "8/8/8/8/8/4k3/4p1K1/8 b - - 0 1", color: "BLACK", objective: "mate", description: "Promote Black's advanced pawn and play through to checkmate.", hint: "Check the promotion choices carefully; avoid reducing the position to insufficient mating material." },
  { id: "rook-pawn-draw", title: "Defend the promotion corner", topic: "King and pawn", fen: "7k/8/5K1P/8/8/8/8/8 b - - 0 1", color: "BLACK", objective: "draw", description: "Hold a draw against a rook pawn with your king in its promotion corner.", hint: "Stay near the promotion corner. A stalemate is a successful draw for the defender." },
  ...importedPawnPositions as EndgamePosition[],
];

export const ENDGAME_CHAPTERS = [
  { id: "basic-checkmates", title: "Basic checkmates", topic: "Basic checkmates", description: "Learn to coordinate your king with a queen or rook and finish with checkmate.", pieces: ["wk", "wq", "wr"] },
  { id: "king-and-pawn", title: "King and pawn endgames", topic: "King and pawn", description: "Practice pawn-versus-king, pawn-versus-pawn, and two-pawn endings with winning and drawing objectives.", pieces: ["wk", "wp", "bk"] },
] as const;

export function chapterPositions(chapterId: string) {
  const chapter = ENDGAME_CHAPTERS.find(item => item.id === chapterId);
  return chapter ? ENDGAMES.filter(item => item.topic === chapter.topic) : [];
}

export function endgameFeedback(position: EndgamePosition, board: Chess, resigned: boolean): string {
  if (resigned) return "Objective not reached · You resigned. Restart to try again.";
  if (!board.isGameOver()) return "Objective in progress · Legal moves are allowed; continuations are not individually graded.";
  const player = position.color === "WHITE" ? "w" : "b";
  const success = position.objective === "draw" ? board.isDraw() : board.isCheckmate() && board.turn() !== player;
  return success ? "Objective reached · " + (position.objective === "draw" ? "You held a draw." : "You delivered checkmate.") : "Objective not reached · Restart to try again.";
}
