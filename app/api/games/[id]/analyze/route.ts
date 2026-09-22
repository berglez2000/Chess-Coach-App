import { analyzeSavedGame } from "@/lib/analysis/client";

export const runtime = "nodejs";

/** Await all work; no background promises survive the request lifecycle. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await analyzeSavedGame(id);
    if (result.status === "ENGINE_COMPLETED") return Response.json(result);
    if (result.status === "NOT_FOUND") return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    if (result.status === "NOT_READY") return Response.json({ error: { code: "ANALYSIS_NOT_READY", message: "Analysis is already running or has completed. Refresh the review to check its status. Interrupted runs can be retried after their five-minute recovery window." } }, { status: 409 });
    return Response.json({ error: { code: result.code, message: result.message } }, { status: 500 });
  } catch {
    return Response.json({ error: { code: "ANALYSIS_UNAVAILABLE", message: "Could not start analysis. Check your local engine and database setup, then retry." } }, { status: 503 });
  }
}
