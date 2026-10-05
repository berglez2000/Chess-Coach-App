import "server-only";
import type { CoachingProvider } from "@/lib/coaching/providers";
import type { PlanInputs } from "@/lib/weekly-plan/contract";
import type { PlanClient } from "@/lib/weekly-plan/ai-client";
export const PLAN_TIMEOUT_MS = 60000;
export function planProviderAvailable() { return true; }
export function createPlanClient(provider: CoachingProvider): PlanClient {
  return { async generate(inputs: PlanInputs) {
    if (inputs.profile.answers.focus === "E2E plan failure") return { status: "FAILED", message: "Synthetic provider timeout. Your accepted plan is preserved." };
    const chapter = inputs.resources.find(r => r.kind === "chapter");
    return { status: "OK", model: `e2e-${provider}-plan-fixture`, definition: { schemaVersion: 1, title: "Weekly chess study", sessions: inputs.profile.answers.availability.map(day => ({ ...day, activity: "Tactics", resourceKey: chapter?.key ?? null })) } };
  } };
}
