import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfile, saveProfile, ProfileError } from "@/lib/learning-profile/repository";
import { ZodError } from "zod";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { return Response.json({ profile: await getProfile(getDb(), user.id) }, { headers }); }
  catch { return Response.json({ error: { message: "Could not load your learning profile. Try again." } }, { status: 503, headers }); }
}
export async function PUT(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const text = await request.text();
    if (text.length > 30000) throw new ProfileError("Your answers are too long.");
    return Response.json({ profile: await saveProfile(getDb(), user.id, JSON.parse(text)) }, { headers });
  } catch (error) {
    const status = error instanceof ProfileError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 503;
    const message = error instanceof ProfileError ? error.message : error instanceof ZodError ? error.issues[0]?.message : error instanceof SyntaxError ? "Send valid profile answers." : "Could not save your learning profile. Your answers are still here; try saving again.";
    return Response.json({ error: { message } }, { status, headers });
  }
}
