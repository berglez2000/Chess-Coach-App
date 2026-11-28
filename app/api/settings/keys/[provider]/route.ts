import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { apiKeyInputSchema, deletePersonalApiKey, personalKeysEnabled, savePersonalApiKey } from "@/lib/coaching/api-keys";
import { getCoachingSettings } from "@/lib/coaching/settings";
import { providerSchema } from "@/lib/coaching/providers";

type Context = { params: Promise<{ provider: string }> };
const headers = { "Cache-Control": "private, no-store" };
const failure = (message: string, status: number) => Response.json({ error: { message } }, { status, headers });
// Responses carry the same status as GET /api/settings: availability and the last four characters, never the key.
export async function PUT(request: Request, context: Context) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const provider = providerSchema.safeParse((await context.params).provider);
  const input = apiKeyInputSchema.safeParse(await request.json().catch(() => null));
  if (!provider.success || !input.success) return failure("Enter the full API key for a supported provider, without spaces.", 400);
  if (!personalKeysEnabled()) return failure("Personal API keys are turned off on this server.", 409);
  try {
    await savePersonalApiKey(getDb(), user.id, provider.data, input.data.apiKey);
    return Response.json(await getCoachingSettings(getDb(), user.id), { headers });
  } catch { return failure("Could not save your API key. Check local PostgreSQL and retry.", 503); }
}
export async function DELETE(request: Request, context: Context) {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const provider = providerSchema.safeParse((await context.params).provider);
  if (!provider.success) return failure("Choose a supported provider.", 400);
  try {
    await deletePersonalApiKey(getDb(), user.id, provider.data);
    return Response.json(await getCoachingSettings(getDb(), user.id), { headers });
  } catch { return failure("Could not remove your API key. Check local PostgreSQL and retry.", 503); }
}
