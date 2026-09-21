import { parsePgn } from "@/lib/pgn/parse";
import { PgnParseError } from "@/lib/pgn/error";
import { importGameSchema } from "@/lib/validation/import-game";
import type { ChessColor, ParsedGame } from "@/types/game";
import type { ImportResponse } from "@/types/import";

export interface ImportRepository {
  create(game: ParsedGame, userColor: ChessColor): Promise<{ id: string }>;
}

export async function importGame(input: unknown, repository: ImportRepository): Promise<ImportResponse> {
  const validated = importGameSchema.safeParse(input);
  if (!validated.success) {
    const fields: { userColor?: string; pgn?: string } = {};
    for (const issue of validated.error.issues) {
      const field = issue.path[0];
      if (field === "userColor" || field === "pgn") fields[field] ??= issue.message;
    }
    return { error: { code: "INVALID_INPUT", message: "Check the highlighted fields.", fields } };
  }
  try {
    const game = parsePgn(validated.data.pgn);
    const { id } = await repository.create(game, validated.data.userColor);
    return { gameId: id, status: "PENDING", userColor: validated.data.userColor, game };
  } catch (error) {
    if (error instanceof PgnParseError) {
      return { error: { code: error.code, message: "The PGN could not be imported.", fields: { pgn: error.message } } };
    }
    return { error: { code: "IMPORT_FAILED", message: "Could not save your game. Your input is still here; please try again." } };
  }
}
