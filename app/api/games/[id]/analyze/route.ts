import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { analyzeSavedGame } from "@/lib/analysis/client";
import { coachSavedGame } from "@/lib/coaching/client";

export const runtime = "nodejs";

/** Await all work; no background promises survive the request lifecycle. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try {
    const { id } = await params;
    const saved = await getDb().game.findUnique({ where: { id, ownerId: user.id }, select: { analysisStatus: true } });
    if (!saved) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    const coachingOnly = saved.analysisStatus === "ENGINE_COMPLETED" || saved.analysisStatus === "AI_RUNNING";
    const engineResult = coachingOnly ? { status: "ENGINE_COMPLETED" as const } : await analyzeSavedGame(id, user.id);
    if (engineResult.status === "NOT_FOUND") return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    if (engineResult.status === "NOT_READY") return Response.json({ error: { code: "ANALYSIS_NOT_READY", message: "Analysis is already running or has completed. Refresh the review to check its status. Interrupted runs can be retried after their five-minute recovery window." } }, { status: 409 });
    if (engineResult.status === "FAILED") return Response.json({ error: { code: engineResult.code, message: engineResult.message } }, { status: 500 });

    // Engine completed — proceed to coaching. Coaching failures are non-fatal:
    // the engine review remains accessible and coaching can be retried.
    const coachingResult = await coachSavedGame(id, user.id);
    if (coachingResult.status === "NOT_READY") return Response.json({ error: { code: "ANALYSIS_NOT_READY", message: "Coaching is already running or has completed. Refresh status before retrying." } }, { status: 409 });
    return Response.json({ engine: engineResult, coaching: coachingResult });
  } catch {
    return Response.json({ error: { code: "ANALYSIS_UNAVAILABLE", message: "Could not start analysis. Check your local engine and database setup, then retry." } }, { status: 503 });
  }
}
