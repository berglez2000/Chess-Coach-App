"use server";

import { parsePgn } from "@/lib/pgn/parse";
import { PgnParseError } from "@/lib/pgn/error";
import { importGameSchema } from "@/lib/validation/import-game";
import type { ImportState } from "@/types/import";

/** Temporary parse-only action; TASK-008 replaces this with persisted import. */
export async function importGame(formData: FormData): Promise<ImportState> {
  if (!(formData instanceof FormData)) {
    return { status: "error", message: "Invalid import request. Please use the import form." };
  }
  const input = importGameSchema.safeParse({
    userColor: formData.get("userColor"),
    pgn: formData.get("pgn"),
  });
  if (!input.success) {
    const fields: { userColor?: string; pgn?: string } = {};
    for (const issue of input.error.issues) {
      const field = issue.path[0];
      if (field === "userColor" || field === "pgn") fields[field] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fields };
  }
  try {
    return {
      status: "success",
      userColor: input.data.userColor,
      game: parsePgn(input.data.pgn),
    };
  } catch (error) {
    if (error instanceof PgnParseError) {
      return { status: "error", message: "The PGN could not be imported.", fields: { pgn: error.message } };
    }
    return { status: "error", message: "Import failed unexpectedly. Please try again." };
  }
}
