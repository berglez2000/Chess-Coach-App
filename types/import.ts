import type { ChessColor, ParsedGame } from "./game";

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: { userColor?: string; pgn?: string } }
  | { status: "success"; userColor: ChessColor; game: ParsedGame };

export type ImportAction = (formData: FormData) => Promise<ImportState>;
