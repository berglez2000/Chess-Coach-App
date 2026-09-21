export type ChessColor = "WHITE" | "BLACK";
export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface ParsedGameMove {
  ply: number;
  moveNumber: number;
  color: ChessColor;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  pgn: string;
  initialFen: string;
  metadata: {
    whiteName: string | null;
    blackName: string | null;
    result: GameResult;
    /** Complete PGN Date as UTC ISO string; unknown/invalid dates are null. */
    playedAt: string | null;
    event: string | null;
    site: string | null;
    round: string | null;
    openingName: string | null;
    eco: string | null;
    timeControl: string | null;
    /** Only the supplied header; never inferred from the board. */
    termination: string | null;
  };
  moves: ParsedGameMove[];
  finalPosition: {
    fen: string;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
  };
}
