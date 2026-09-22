import { analyzeSavedGame } from "@/lib/analysis/client";
import { coachSavedGame } from "@/lib/coaching/client";

export const runtime = "nodejs";

/** Await all work; no background promises survive the request lifecycle. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const engineResult = await analyzeSavedGame(id);
    if (engineResult.status === "NOT_FOUND") return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    if (engineResult.status === "NOT_READY") return Response.json({ error: { code: "ANALYSIS_NOT_READY", message: "Analysis is already running or has completed. Refresh the review to check its status. Interrupted runs can be retried after their five-minute recovery window." } }, { status: 409 });
    if (engineResult.status === "FAILED") return Response.json({ error: { code: engineResult.code, message: engineResult.message } }, { status: 500 });

    // Engine completed — proceed to coaching. Coaching failures are non-fatal:
    // the engine review remains accessible and coaching can be retried.
    const coachingResult = await coachSavedGame(id);
    return Response.json({ engine: engineResult, coaching: coachingResult });
  } catch {
    return Response.json({ error: { code: "ANALYSIS_UNAVAILABLE", message: "Could not start analysis. Check your local engine and database setup, then retry." } }, { status: 503 });
  }
}
