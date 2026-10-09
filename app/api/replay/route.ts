import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { startReplaySchema } from "@/lib/replay/contract";
import { startReplay } from "@/lib/replay/repository";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = startReplaySchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Invalid session request." } }, { status: 400 });
  try {
    const session = await startReplay(getDb(), user.id, input.data.requestId, input.data.gameId);
    return session ? Response.json({ session }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: { message: "No eligible puzzles available. Generate puzzles from a reviewed game first." } }, { status: 404 });
  } catch { return Response.json({ error: { message: "Could not start practice. Please retry." } }, { status: 503 }); }
}
