import { ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getCoachingProvider } from "@/lib/coaching/settings";
import { createPlanClient, planProviderAvailable } from "@/lib/weekly-plan/ai-client";
import { planActionSchema, PlanError } from "@/lib/weekly-plan/contract";
import { getPlanState, mutateDraft } from "@/lib/weekly-plan/repository";
import { currentResourceKeys } from "@/lib/weekly-plan/catalog";
import { generatePlan } from "@/lib/weekly-plan/generate";
export const runtime = "nodejs";
async function responseState(userId: string) {
  const db = getDb(); const state = await getPlanState(db, userId);
  const inputs = [state.draft?.inputs, state.accepted?.inputs].filter(input => input !== undefined);
  const keys = await Promise.all(inputs.map(input => currentResourceKeys(db, userId, input)));
  return Response.json({ state, availableKeys: [...new Set(keys.flatMap(set => [...set]))] }, { headers });
}
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try { return await responseState(user.id); }
  catch { return Response.json({ error: { message: "Could not load your weekly plan. Try again." } }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const user = await requireApiUser(request); if (user instanceof Response) return user;
  try {
    const text = await request.text(); if (text.length > 30000) throw new PlanError("The plan request is too large.");
    const action = planActionSchema.parse(JSON.parse(text));
    const db = getDb();
    if (action.action === "GENERATE") {
      const provider = await getCoachingProvider(db, user.id);
      const prior = await db.weeklyPlanGeneration.findUnique({ where: { userId_requestId: { userId: user.id, requestId: action.requestId } } });
      if (!prior && !planProviderAvailable(provider)) throw new PlanError("The selected provider has no API key. Configure it in the server environment or select an available provider in Settings.", 503);
      await generatePlan(db, user.id, action, provider, createPlanClient(provider));
      return await responseState(user.id);
    }
    await mutateDraft(db, user.id, action);
    return await responseState(user.id);
  } catch (error) {
    const status = error instanceof PlanError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 503;
    const message = error instanceof PlanError ? error.message : status === 400 ? "Check the plan's required fields and session values." : "Could not update your plan. Refresh its status before retrying.";
    return Response.json({ error: { message } }, { status, headers });
  }
}
