import { requireApiUser } from "@/lib/auth/session";
import { z } from "zod";
import { coachSavedGame } from "@/lib/coaching/client";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = z.object({ expectedRevision: z.number().int().nonnegative().max(2147483646) }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Refresh the review before regenerating coaching." } }, { status: 400 });
  try {
    const { id } = await params;
    const coaching = await coachSavedGame(id, user.id, input.data.expectedRevision);
    if (coaching.status === "NOT_FOUND") return Response.json({ error: { message: "Game not found." } }, { status: 404 });
    if (coaching.status === "NOT_READY" || coaching.status === "NO_ENGINE_DATA") return Response.json({ error: { message: "Coaching changed, analysis is running, or engine results are incomplete. Refresh the review before retrying." } }, { status: 409 });
    return Response.json({ coaching });
  } catch { return Response.json({ error: { message: "Could not start coaching. Check local PostgreSQL and retry." } }, { status: 503 }); }
}
