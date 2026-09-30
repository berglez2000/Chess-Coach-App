import { requireApiUser } from "@/lib/auth/session";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getCoachingSettings, saveCoachingProvider } from "@/lib/coaching/settings";
import { providerSchema } from "@/lib/coaching/providers";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  try { return Response.json(await getCoachingSettings(getDb(), user.id)); }
  catch { return Response.json({ error: { message: "Could not load settings. Check local PostgreSQL and retry." } }, { status: 503 }); }
}
export async function PUT(request: Request) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const input = z.object({ provider: providerSchema }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: { message: "Choose Anthropic (Claude) or OpenAI (GPT)." } }, { status: 400 });
  try {
    await saveCoachingProvider(getDb(), input.data.provider, user.id);
    return Response.json(await getCoachingSettings(getDb(), user.id));
  } catch { return Response.json({ error: { message: "Could not save settings. Check local PostgreSQL and retry." } }, { status: 503 }); }
}
