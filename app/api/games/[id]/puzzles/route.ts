import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createStockfish } from "@/lib/engine/stockfish";
import { generatePuzzles } from "@/lib/puzzles/generate";
import { PUZZLE_POLICY } from "@/lib/puzzles/policy";
import { createPuzzleRepository, puzzleSummary, PUZZLE_FAILURE } from "@/lib/puzzles/repository";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const { id } = await params;
    const db = getDb();
    const outcome = await generatePuzzles(id, createPuzzleRepository(db, user.id), () => createStockfish({
      path: process.env.STOCKFISH_PATH ?? "", depth: PUZZLE_POLICY.depth,
      timeoutMs: PUZZLE_POLICY.timeoutMs, multiPv: PUZZLE_POLICY.multiPv,
    }));
    if (outcome.status === "NOT_FOUND") return Response.json({ error: { message: "Game not found." } }, { status: 404 });
    if (outcome.status === "NOT_READY") return Response.json({ error: { message: "Save engine analysis before generating puzzles. Wait for any running engine analysis to finish." } }, { status: 409 });
    if (outcome.status === "BUSY") return Response.json({ error: { message: "Puzzle generation is already running. Refresh status; interrupted runs can be retried after five minutes." } }, { status: 409 });
    if (outcome.status === "FAILED") return Response.json({ error: { message: PUZZLE_FAILURE } }, { status: 503 });
    return Response.json({ generation: await puzzleSummary(db, id, user.id) });
  } catch {
    return Response.json({ error: { message: PUZZLE_FAILURE } }, { status: 503 });
  }
}
