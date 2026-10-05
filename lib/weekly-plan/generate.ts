import { requireOwnerId } from "@/lib/auth/owner";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CoachingProvider } from "@/lib/coaching/providers";
import { PROVIDERS } from "@/lib/coaching/providers";
import { planInputs } from "./catalog";
import { finishGeneration, generationInputs, getPlanState, startGeneration } from "./repository";
import { PlanError, type PlanAction } from "./contract";
import type { PlanClient, PlanOutcome } from "@/lib/weekly-plan/ai-client";
import { PLAN_TIMEOUT_MS } from "@/lib/weekly-plan/ai-client";

/** Explicit request only; retries reuse the durable request ID without a second paid call. */
export async function generatePlan(db: PrismaClient, userId: string, action: Extract<PlanAction, { action: "GENERATE" }>, provider: CoachingProvider, client: PlanClient, timeoutMs = PLAN_TIMEOUT_MS) {
  requireOwnerId(userId);
  const existing = await db.weeklyPlanGeneration.findUnique({ where: { userId_requestId: { userId, requestId: action.requestId } } });
  // Replays still verify the original request payload, but do not rebuild inputs or call a provider.
  if (existing) {
    if (existing.baseRevision !== action.expectedRevision) throw new PlanError("This generation request ID was already used for different inputs.", 409);
    return getPlanState(db, userId);
  }
  const inputs = await planInputs(db, userId);
  const claimed = await startGeneration(db, userId, action, inputs, provider, PROVIDERS[provider].model);
  if (!claimed.claimed) return getPlanState(db, userId);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<PlanOutcome>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve({ status: "FAILED", message: "Plan generation timed out. Your saved plans are preserved; try again." }); }, timeoutMs);
    });
    const response = await Promise.race([client.generate(generationInputs(claimed.generation), controller.signal), timeout]);
    await finishGeneration(db, userId, claimed.generation.id, response.status === "OK" ? { definition: response.definition, model: response.model } : { error: response.message });
  } catch {
    await finishGeneration(db, userId, claimed.generation.id, { error: "Plan generation failed. Your saved plans are preserved; try again." });
  } finally { if (timer) clearTimeout(timer); controller.abort(); }
  return getPlanState(db, userId);
}
