import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { openingRepository } from "@/lib/openings/repository";
import { openingFailure, openingJson } from "@/lib/openings/http";
import { removeVideoFile, streamVideo } from "@/lib/openings/videos";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; videoId: string }> };
export async function GET(request: Request, context: Context) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { const { id, videoId } = await context.params; const video = await openingRepository(getDb(), user.id).video(id, videoId); return await streamVideo(video.id, video.size, request); } catch (error) { return openingFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const { id, videoId } = await context.params; const repo = openingRepository(getDb(), user.id);
    await repo.video(id, videoId);
    await removeVideoFile(videoId); await repo.deleteVideo(id, videoId);
    return openingJson({ opening: await repo.get(id) });
  } catch (error) { return openingFailure(error); }
}
