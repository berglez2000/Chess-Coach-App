import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { act, practice } from "@/lib/learning/repository";
import { z } from "zod";
const learningActionSchema = z.discriminatedUnion("action", [
  z.object({ requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646), action: z.literal("MOVE"), move: z.string().regex(/^(?:[a-h][1-8][a-h][1-8][qrbn]?|[pnbrq]@[a-h][1-8])$/) }).strict(),
  z.object({ requestId: z.uuid(), expectedRevision: z.number().int().min(0).max(2147483646), action: z.enum(["HINT", "REVEAL", "RETRY"]) }).strict(),
]);
export const runtime = "nodejs";
const missing = () => Response.json({ error: { message: "Exercise not found or revision no longer available. Return to the chapter." } }, { status: 404 });
const unavailable = () => Response.json({ error: { message: "Could not save or load progress. Refresh before retrying." } }, { status: 503 });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const puzzle = await practice(getDb(), user.id, (await params).id, new URL(request.url).searchParams.get("revision") ?? undefined);
    return puzzle ? Response.json({ puzzle }, { headers: { "Cache-Control": "private, no-store" } }) : missing();
  } catch { return unavailable(); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  let input;
  try { input = learningActionSchema.safeParse(await request.json()); } catch { /* invalid JSON */ }
  if (!input?.success) return Response.json({ error: { message: "Invalid exercise action." } }, { status: 400 });
  const revisionId = new URL(request.url).searchParams.get("revision"); if (!revisionId || revisionId.length > 100) return missing();
  try {
    const result = await act(getDb(), user.id, (await params).id, revisionId, input.data);
    if (result.status === "NOT_FOUND") return missing();
    return Response.json({ puzzle: result.puzzle, ...(result.status === "CONFLICT" ? { error: { message: "Progress changed in another request. The saved position is shown; try again." } } : {}) },
      { status: result.status === "CONFLICT" ? 409 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch { return unavailable(); }
}
