import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ENDGAMES } from "@/lib/endgames/catalog";
import { snapshotSchema } from "@/lib/endgames/progress";
import { saveEndgameProgress } from "@/lib/endgames/repository";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const schema = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), snapshot: snapshotSchema }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ positionId: string }> }) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  const { positionId } = await params;
  const position = ENDGAMES.find(item => item.id === positionId);
  if (!position) return Response.json({ error: { message: "Position not found." } }, { status: 404, headers });
  let input: z.infer<typeof schema>;
  try {
    const reader = request.body!.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 12000) throw new Error(); chunks.push(value); } }
    finally { await reader.cancel(); reader.releaseLock(); }
    input = schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch { return Response.json({ error: { message: "Invalid practice save." } }, { status: 400, headers }); }
  try {
    const result = await saveEndgameProgress(getDb(), user.id, position, input);
    return Response.json(result, { status: result.status === "OK" ? 200 : 409, headers });
  } catch {
    return Response.json({ error: { message: "Practice could not be saved. Retry, or reload to recover the last saved position." } }, { status: 503, headers });
  }
}
