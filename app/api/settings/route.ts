import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getCoachingSettings, saveCoachingSelection } from "@/lib/coaching/settings";
import { coachingSelectionSchema } from "@/lib/coaching/providers";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  try { return Response.json(await getCoachingSettings(getDb(), user.id)); }
  catch { return Response.json({ error: { message: "Could not load settings. Check local PostgreSQL and retry." } }, { status: 503 }); }
}
export async function PUT(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = coachingSelectionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Choose a supported provider, model, and coaching style." } }, { status: 400 });
  try {
    await saveCoachingSelection(getDb(), input.data, user.id);
    return Response.json(await getCoachingSettings(getDb(), user.id));
  } catch { return Response.json({ error: { message: "Could not save settings. Check local PostgreSQL and retry." } }, { status: 503 }); }
}
