import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { replayActionSchema } from "@/lib/replay/contract";
import { actOnReplay, findReplay } from "@/lib/replay/repository";
export const runtime = "nodejs";
const missing = () => Response.json({ error: { message: "Practice session not found." } }, { status: 404 });
const unavailable = () => Response.json({ error: { message: "Could not load or save practice. Refresh saved progress before retrying." } }, { status: 503 });
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  try { const session = await findReplay(getDb(), (await params).id, user.id); return session ? Response.json({ session, puzzle: session.puzzle }, { headers }) : missing(); }
  catch { return unavailable(); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = replayActionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Invalid practice action." } }, { status: 400 });
  try {
    const result = await actOnReplay(getDb(), (await params).id, user.id, input.data);
    if (result.status === "NOT_FOUND") return missing();
    return Response.json({ session: result.session, puzzle: result.session.puzzle,
      ...(result.status === "CONFLICT" ? { error: { message: "Progress changed. The latest saved challenge is shown." } } : {}) }, { status: result.status === "CONFLICT" ? 409 : 200, headers });
  } catch { return unavailable(); }
}
