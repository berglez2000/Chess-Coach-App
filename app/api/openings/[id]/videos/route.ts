import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { OpeningError } from "@/lib/openings/content";
import { openingRepository } from "@/lib/openings/repository";
import { openingFailure, openingJson } from "@/lib/openings/http";
import { removeVideoFile, storeVideo } from "@/lib/openings/videos";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const { id } = await context.params; const repo = openingRepository(getDb(), user.id);
    await repo.get(id);
    const name = new URL(request.url).searchParams.get("name")?.trim();
    if (!name || name.length > 200) throw new OpeningError("Give this video a title of 1–200 characters.");
    const stored = await storeVideo(request);
    try { await repo.addVideo(id, { ...stored, name }); } catch (error) { await removeVideoFile(stored.id); throw error; }
    return openingJson({ opening: await repo.get(id) }, 201);
  } catch (error) { return openingFailure(error); }
}
