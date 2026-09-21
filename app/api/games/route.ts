import { listGames } from "@/lib/games/queries";
import { getDb } from "@/lib/db/client";
import { importGame } from "@/lib/games/import-game";
import { createImportRepository } from "@/lib/games/import-repository";
import type { ImportResponse } from "@/types/import";

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: { code: "INVALID_REQUEST", message: "Send a valid JSON import request." } } satisfies ImportResponse, { status: 400 });
  }
  // Connect only after validation; configuration failures are sanitized by the service.
  const result = await importGame(input, {
    create: (game, color) => createImportRepository(getDb()).create(game, color),
  });
  return Response.json(result, { status: "error" in result ? result.error.code === "IMPORT_FAILED" ? 500 : 400 : 201 });
}

export async function GET() {
  try {
    return Response.json({ games: await listGames(getDb()) });
  } catch {
    return Response.json({ error: { code: "READ_FAILED", message: "Could not load your games. Please try again." } }, { status: 500 });
  }
}
