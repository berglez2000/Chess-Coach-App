import { getDb } from "@/lib/db/client";
import { findGame } from "@/lib/games/queries";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const game = await findGame(getDb(), id);
    if (!game) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    return Response.json({ game });
  } catch {
    return Response.json({ error: { code: "READ_FAILED", message: "Could not load this game. Please try again." } }, { status: 500 });
  }
}
