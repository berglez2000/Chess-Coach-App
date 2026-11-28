import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { noteRequestSchema, saveNote } from "@/lib/games/notes";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = noteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { code: "INVALID_NOTE", message: "This note could not be saved. Shorten it and try again." } }, { status: 400 });
  try {
    const { id } = await params;
    const note = await saveNote(getDb(), id, user.id, input.data.ply, input.data.text);
    if (note === undefined) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "Game not found." } }, { status: 404 });
    return Response.json({ note });
  } catch {
    return Response.json({ error: { code: "SAVE_FAILED", message: "Could not save this note. Please try again." } }, { status: 500 });
  }
}
