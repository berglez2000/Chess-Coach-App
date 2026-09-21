import type { ImportAction, ImportResponse } from "@/types/import";

export const requestGameImport: ImportAction = async (data) => {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userColor: data.get("userColor"), pgn: data.get("pgn") }),
  });
  const result = await response.json() as ImportResponse;
  if ("error" in result) {
    return { status: "error", message: result.error.message, fields: result.error.fields };
  }
  if (!response.ok) throw new Error("Import request failed.");
  return { status: "success", gameId: result.gameId, userColor: result.userColor, game: result.game };
};
