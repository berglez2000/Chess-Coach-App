import type { ChessColor, ParsedGame } from "./game";
import type { PgnErrorCode } from "@/lib/pgn/error";

export type ImportResponse =
  | { gameId: string; status: "PENDING"; userColor: ChessColor; game: ParsedGame }
  | { error: { code: "INVALID_REQUEST" | "INVALID_INPUT" | "IMPORT_FAILED" | PgnErrorCode; message: string; fields?: { userColor?: string; pgn?: string } } };

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: { userColor?: string; pgn?: string } }
  | { status: "success"; gameId: string; userColor: ChessColor; game: ParsedGame };

export type ImportAction = (formData: FormData) => Promise<ImportState>;
