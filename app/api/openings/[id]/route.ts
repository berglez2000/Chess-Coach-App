import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { OpeningError, openingSchema } from "@/lib/openings/content";
import { openingRepository } from "@/lib/openings/repository";
import { openingFailure, openingJson, readOpeningJson } from "@/lib/openings/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { return openingJson({ opening: await openingRepository(getDb(), user.id).get((await context.params).id) }); } catch (error) { return openingFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const parsed = z.object({ revision: z.number().int().min(0), content: openingSchema }).strict().safeParse(await readOpeningJson(request));
    if (!parsed.success) throw new OpeningError("Check your opening details and revision.");
    return openingJson({ opening: await openingRepository(getDb(), user.id).update((await context.params).id, parsed.data.revision, parsed.data.content) });
  } catch (error) { return openingFailure(error); }
}
